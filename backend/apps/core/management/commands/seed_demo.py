"""Génère un jeu de données de démonstration réaliste.

    python manage.py seed_demo --reset          # efface et recrée tout, puis entraîne les modèles
    python manage.py seed_demo --learners 200   # moins d'apprenants (plus rapide)

Les comportements des apprenants sont simulés (motivation, régularité, préférence pour le
week-end, tendance à sauter les vidéos…). Les apprenants qui finissent par abandonner montrent
des signes de décrochage avant de s'arrêter : c'est ce que le modèle d'abandon apprend à repérer.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import LearnerProfile, User
from apps.administration.models import ActivityLog, PlatformSettings
from apps.core import seed_data as S
from apps.courses.models import (
    AttemptAnswer,
    Category,
    Choice,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    Question,
    Quiz,
    QuizAttempt,
    Review,
    Tag,
)
from apps.engagement.models import Intervention, Notification
from apps.ml.models import (
    CourseEmbedding,
    DropoutPrediction,
    LearnerSegment,
    ModelVersion,
    Recommendation,
    RecommendationFeedback,
    TrainingRun,
)
from apps.tracking.models import LearningEvent

DEMO_PASSWORD = "Demo1234!"
ADMIN_PASSWORD = "Admin1234!"


@dataclass
class Behaviour:
    motivation: float
    regularity: float
    weekend: float
    hurried: float
    skill: float
    hours_factor: float


@dataclass
class CourseRuntime:
    key: str
    id: int
    title: str
    slug: str
    difficulty: float
    hard_module: int | None
    published_at: datetime
    tags: set[str]
    category: str
    items: list[dict] = field(default_factory=list)  # leçons et quiz dans l'ordre
    lesson_count: int = 0
    quiz_count: int = 0


class Command(BaseCommand):
    help = "Crée des données de démonstration réalistes (catalogue, apprenants, comportements, événements)."

    def add_arguments(self, parser):
        parser.add_argument("--learners", type=int, default=450)
        parser.add_argument("--reset", action="store_true", help="Efface toutes les données existantes avant de générer.")
        parser.add_argument("--no-train", action="store_true", help="Ne pas entraîner les modèles à la fin.")
        parser.add_argument("--seed", type=int, default=42)

    # ------------------------------------------------------------------ helpers
    def handle(self, *args, **options):
        if Course.objects.exists() and not options["reset"]:
            raise CommandError("Des données existent déjà. Relance avec --reset pour tout effacer et recommencer.")
        self.rng = random.Random(options["seed"])
        self.now = timezone.now()
        self.password_hash = make_password(DEMO_PASSWORD)
        self.events: list[LearningEvent] = []
        self.progress: dict[tuple[int, int], dict] = {}
        self.attempts: list[tuple[QuizAttempt, list[tuple[int, int | None, bool]]]] = []
        self.enrollments: list[Enrollment] = []
        self.reviews: list[Review] = []

        with transaction.atomic():
            if options["reset"]:
                self.stdout.write("Suppression des données existantes…")
                self.reset()
            PlatformSettings.load()
            self.stdout.write("Création du catalogue…")
            self.create_catalog()
            self.stdout.write(f"Simulation de {options['learners']} apprenants…")
            self.create_learners(options["learners"])
            self.create_scripted_learners()
            self.stdout.write("Enregistrement des événements…")
            self.flush()
            self.create_admin_history()

        self.stdout.write(self.style.SUCCESS(
            f"Données créées : {User.objects.count()} comptes, {Course.objects.count()} cours, "
            f"{Enrollment.objects.count()} inscriptions, {LearningEvent.objects.count()} événements."
        ))
        if not options["no_train"]:
            from apps.ml.pipeline import start_training

            self.stdout.write("Entraînement des modèles…")
            run = start_training(trigger="seed", background=False)
            for step in run.steps:
                self.stdout.write(f"  {'✔' if step['status'] == 'success' else '✖'} {step['label']} : {step.get('detail', '')}")
            if run.status != TrainingRun.Status.SUCCESS:
                self.stderr.write(run.error)
        self.stdout.write(self.style.SUCCESS("Terminé. Comptes de démonstration :"))
        self.stdout.write(f"  Apprenante : aminata@learningdata.app / {DEMO_PASSWORD}")
        self.stdout.write(f"  Formateur  : issa.traore@learningdata.app / {DEMO_PASSWORD}")
        self.stdout.write(f"  Admin      : admin@learningdata.app / {ADMIN_PASSWORD}")

    def reset(self):
        for model in (AttemptAnswer, QuizAttempt, LessonProgress, Review, Enrollment, LearningEvent, Recommendation,
                      RecommendationFeedback, DropoutPrediction, LearnerSegment, CourseEmbedding, ModelVersion,
                      TrainingRun, Intervention, Notification, ActivityLog):
            model.objects.all().delete()
        Course.objects.all().delete()
        Tag.objects.all().delete()
        Category.objects.all().delete()
        User.objects.all().delete()
        from apps.ml import artifacts

        for name in ("recommender", "dropout"):
            path = artifacts._path(name)
            if path.exists():
                path.unlink()
        artifacts.clear_cache()

    def ago(self, days: float, hour: int | None = None) -> datetime:
        moment = self.now - timedelta(days=days)
        if hour is not None:
            moment = moment.replace(hour=hour, minute=self.rng.randint(0, 59), second=self.rng.randint(0, 59))
            if moment > self.now:
                moment = self.now - timedelta(minutes=self.rng.randint(5, 120))
        return moment

    # ------------------------------------------------------------------ catalogue
    def create_catalog(self):
        self.categories = {}
        for slug, name, color, _tint, description in S.CATEGORIES:
            self.categories[slug] = Category.objects.create(slug=slug, name=name, color=color, description=description)
        self.tints = {slug: tint for slug, _n, _c, tint, _d in S.CATEGORIES}

        admin = User.objects.create_superuser(
            email="admin@learningdata.app", password=ADMIN_PASSWORD, first_name="Nadia", last_name="Sanou",
            headline="Administratrice de la plateforme",
        )
        User.objects.filter(pk=admin.pk).update(date_joined=self.ago(300))
        self.admin = admin
        self.instructors = {}
        for key, (first, last, email, headline) in S.INSTRUCTORS.items():
            user = User.objects.create(
                email=email, first_name=first, last_name=last, headline=headline, role=User.Role.INSTRUCTOR,
                password=self.password_hash, date_joined=self.ago(self.rng.randint(280, 320)),
            )
            self.instructors[key] = user
        # Un formateur en attente de validation.
        User.objects.create(
            email="karim.bationo@learningdata.app", first_name="Karim", last_name="Bationo",
            headline="Expert Excel", role=User.Role.INSTRUCTOR, status=User.Status.PENDING,
            password=self.password_hash, date_joined=self.ago(2),
        )

        self.tags = {}
        all_lesson_titles = [
            (spec["key"], lesson if isinstance(lesson, str) else lesson["title"])
            for spec in S.COURSES
            for module in spec["modules"]
            for lesson in module[1]
        ]
        self.courses: dict[str, CourseRuntime] = {}
        for spec in S.COURSES:
            self.create_course(spec, all_lesson_titles)

    def tag(self, name: str) -> Tag:
        if name not in self.tags:
            self.tags[name] = Tag.objects.create(name=name)
        return self.tags[name]

    def create_course(self, spec: dict, all_lesson_titles):
        status = spec.get("status", Course.Status.PUBLISHED)
        modules_spec = spec["modules"]
        description = spec.get("description") or (
            f"{spec['subtitle']} Ce cours est organisé en {len(modules_spec)} modules : "
            + ", ".join(f"« {m[0]} »" for m in modules_spec)
            + ". Chaque module se termine par un quiz pour vérifier tes acquis."
        )
        published_at = self.ago(spec["published_days_ago"]) if status == Course.Status.PUBLISHED else None
        course = Course.objects.create(
            title=spec["title"],
            subtitle=spec["subtitle"],
            description=description,
            category=self.categories[spec["category"]],
            level=spec["level"],
            instructor=self.instructors[spec["instructor"]],
            learning_outcomes=spec.get("outcomes") or [m[0] for m in modules_spec],
            cover_color=self.tints[spec["category"]],
            status=status,
            published_at=published_at,
            submitted_at=self.ago(spec["submitted_days_ago"]) if "submitted_days_ago" in spec else None,
        )
        Course.objects.filter(pk=course.pk).update(created_at=published_at or self.ago(10))
        course.tags.set([self.tag(t) for t in spec["tags"]])
        runtime = CourseRuntime(
            key=spec["key"], id=course.id, title=course.title, slug=course.slug, difficulty=spec.get("difficulty", 0.4),
            hard_module=spec.get("hard_module"), published_at=published_at or self.now, tags=set(spec["tags"]),
            category=spec["category"],
        )
        for m_index, module_spec in enumerate(modules_spec, start=1):
            title = module_spec[0]
            module = Module.objects.create(course=course, title=title, order=m_index)
            lessons = []
            for l_index, lesson_spec in enumerate(module_spec[1], start=1):
                if isinstance(lesson_spec, str):
                    lesson_spec = S.L(lesson_spec, minutes=self.rng.randint(8, 16), video=self.rng.random() > 0.2)
                content = lesson_spec["content"] or self.generic_content(title, lesson_spec["title"])
                lesson = Lesson.objects.create(
                    module=module, title=lesson_spec["title"], order=l_index, content=content,
                    video_url=S.VIDEO_URL if lesson_spec["video"] else "", duration_minutes=lesson_spec["minutes"],
                )
                lessons.append(lesson)
                runtime.items.append({"type": "lesson", "id": lesson.id, "minutes": lesson.duration_minutes,
                                      "video": bool(lesson.video_url), "module": m_index})
                runtime.lesson_count += 1
            if spec.get("missing_quiz_module") == m_index:
                continue
            questions = module_spec[2] if len(module_spec) > 2 else self.generic_questions(spec, title, lessons, all_lesson_titles)
            quiz = Quiz.objects.create(module=module, title=f"Quiz · {title}", pass_score=70)
            q_runtime = []
            for q_index, q in enumerate(questions, start=1):
                lesson = lessons[min(q["lesson"], len(lessons) - 1)] if lessons else None
                question = Question.objects.create(
                    quiz=quiz, text=q["text"], code=q["code"], topic=q["topic"], hint=q["hint"],
                    explanation=q["explanation"], lesson=lesson, order=q_index,
                )
                choices = list(enumerate(q["choices"]))
                self.rng.shuffle(choices)
                created = Choice.objects.bulk_create(
                    [Choice(question=question, text=text, is_correct=(orig == 0), order=i) for i, (orig, text) in enumerate(choices, start=1)]
                )
                q_runtime.append({"id": question.id, "choices": [(c.id, c.is_correct) for c in created]})
            runtime.items.append({"type": "quiz", "id": quiz.id, "module": m_index, "questions": q_runtime, "pass": 70})
            runtime.quiz_count += 1
        self.courses[spec["key"]] = runtime

    def generic_content(self, module_title: str, lesson_title: str) -> str:
        return (
            f"Dans cette leçon, tu découvres « {lesson_title} », une étape clé du module « {module_title} ». "
            "Les notions sont présentées avec des exemples concrets, puis tu les appliques dans un court exercice guidé.\n\n"
            f"- Comprendre l'essentiel de « {lesson_title} »\n- Voir un exemple concret pas à pas\n- T'entraîner avec un exercice"
        )

    def generic_questions(self, spec, module_title, lessons, all_lesson_titles):
        others = [t for key, t in all_lesson_titles if key != spec["key"]]
        questions = []
        for index, lesson in enumerate(lessons[:2]):
            distractors = self.rng.sample(others, 3)
            questions.append(S.Q(
                f"Laquelle de ces notions est abordée dans le module « {module_title} » ?",
                [lesson.title, *distractors], module_title, index,
                explanation=f"« {lesson.title} » est une leçon de ce module.",
            ))
        if len(questions) < 2:
            other_subtitles = [c["subtitle"] for c in S.COURSES if c["key"] != spec["key"]]
            questions.append(S.Q(
                f"Quel est l'objectif du cours « {spec['title']} » ?",
                [spec["subtitle"], *self.rng.sample(other_subtitles, 3)], "Objectifs du cours", 0,
            ))
        return questions

    # ------------------------------------------------------------------ apprenants
    def make_behaviour(self) -> Behaviour:
        r = self.rng
        weekend = 0.6 + 0.35 * r.random() if r.random() < 0.22 else r.betavariate(1.2, 5)
        hurried = r.betavariate(5, 2) if r.random() < 0.2 else r.betavariate(1.3, 5)
        return Behaviour(
            motivation=r.betavariate(2.4, 1.7),
            regularity=r.betavariate(2.2, 2),
            weekend=weekend,
            hurried=hurried,
            skill=min(0.98, max(0.35, r.gauss(0.72, 0.12))),
            hours_factor=r.choice([0.6, 1.0, 1.4, 1.8]),
        )

    def create_learners(self, count: int):
        r = self.rng
        # Adresses réservées aux scénarios scriptés (voir create_scripted_learners).
        used_emails = {"moussa.sawadogo", "awa.traore", "fatou.diallo", "ibrahim.compaore", "yasmine.dao"}
        users, plans = [], []
        for i in range(count):
            first, last = r.choice(S.FIRST_NAMES), r.choice(S.LAST_NAMES)
            base = f"{first}.{last}".lower()
            for a, b in (("é", "e"), ("è", "e"), ("ï", "i"), ("ë", "e"), (" ", "")):
                base = base.replace(a, b)
            email = f"{base}{'' if base not in used_emails else i}@mail.com"
            used_emails.add(base)
            days_ago = int(330 * (1 - math.sqrt(r.random()))) + 1
            joined = self.ago(days_ago, hour=r.randint(8, 21))
            goal = r.choices(["data_analyst", "developer", "ai", "career"], weights=[40, 25, 15, 20])[0]
            users.append(User(
                email=email, first_name=first, last_name=last, role=User.Role.LEARNER, password=self.password_hash,
                date_joined=joined,
            ))
            plans.append((goal, joined))
        users = User.objects.bulk_create(users, batch_size=500)
        self.create_profiles(users, [p[0] for p in plans])
        for user, (goal, joined) in zip(users, plans):
            self.simulate_learner(user, goal, joined, self.make_behaviour())

    def create_profiles(self, users, goals, levels=None, hours=None, interests=None):
        r = self.rng
        profiles = []
        interest_rows = []
        for index, (user, goal) in enumerate(zip(users, goals)):
            level = levels[index] if levels else r.choices(["beginner", "intermediate", "advanced"], weights=[60, 30, 10])[0]
            weekly = hours[index] if hours else r.choice(["1-2", "3-5", "3-5", "6-10", "10+"])
            profiles.append(LearnerProfile(user=user, goal=goal, level=level, weekly_hours=weekly, onboarding_completed=True))
            chosen = interests[index] if interests else r.sample(S.GOAL_INTERESTS[goal], r.randint(3, 5))
            interest_rows.extend((user.id, name) for name in chosen)
        LearnerProfile.objects.bulk_create(profiles, batch_size=500)
        by_user = {p.user_id: p for p in LearnerProfile.objects.filter(user__in=users)}
        through = LearnerProfile.interests.through
        through.objects.bulk_create(
            [through(learnerprofile_id=by_user[uid].id, tag_id=self.tag(name).id) for uid, name in interest_rows],
            batch_size=2000,
            ignore_conflicts=True,
        )

    def pick_course(self, goal: str, taken: set[str], start: datetime, interests: set[str]) -> CourseRuntime | None:
        r = self.rng
        available = [c for c in self.courses.values() if c.published_at <= start and c.key not in taken and c.items
                     and c.key not in {"deep", "communiquer", "projet_final"}]
        if not available:
            return None
        path = [k for k in S.GOAL_PATHS[goal] if k not in taken and self.courses[k].published_at <= start]
        if path and r.random() < 0.78:
            index = 1 if len(path) > 1 and r.random() < 0.18 else 0
            return self.courses[path[index]]
        weights = [1 + 3 * len(c.tags & interests) for c in available]
        return r.choices(available, weights=weights)[0]

    def simulate_learner(self, user, goal, joined, b: Behaviour):
        r = self.rng
        taken: set[str] = set()
        interests = set(S.GOAL_INTERESTS[goal])
        start = joined + timedelta(hours=r.randint(1, 72))
        max_courses = 1 + min(4, int(r.expovariate(1 / (0.6 + 2.2 * b.motivation))))
        last_seen = joined
        for _ in range(max_courses):
            if start >= self.now - timedelta(hours=2):
                break
            course = self.pick_course(goal, taken, start, interests)
            if course is None:
                break
            taken.add(course.key)
            end, outcome = self.simulate_enrollment(user, course, start, b)
            last_seen = max(last_seen, end)
            if outcome == "ongoing":
                break
            if outcome == "dropped" and r.random() > 0.4:
                break
            gap = r.randint(1, 12) if outcome == "completed" else r.randint(5, 30)
            start = end + timedelta(days=gap, hours=r.randint(0, 6))
        User.objects.filter(pk=user.pk).update(last_login=last_seen)

    # ------------------------------------------------------------------ inscription
    def simulate_enrollment(self, user, course: CourseRuntime, start: datetime, b: Behaviour, plan: dict | None = None):
        """Simule l'activité d'un apprenant sur un cours. Renvoie (dernière activité, issue)."""
        r = self.rng
        plan = plan or {}
        total = len(course.items)
        p_drop = 0.55 - 0.72 * b.motivation + 0.35 * course.difficulty
        will_drop = plan.get("drop", r.random() < min(0.9, max(0.04, p_drop)))
        if will_drop:
            if course.hard_module and r.random() < 0.55:
                indexes = [i for i, it in enumerate(course.items) if it["module"] == course.hard_module + 1]
                drop_at = r.choice(indexes) if indexes else r.randint(1, max(1, total - 2))
            else:
                drop_at = r.randint(1, max(1, int(total * 0.75)))
        else:
            drop_at = None
        drop_at = plan.get("drop_at", drop_at)
        # Le décrochage commence quelques étapes avant l'arrêt : sessions plus espacées,
        # vidéos abandonnées, leçons non validées.
        decline_from = max(0, drop_at - r.randint(1, 3)) if drop_at is not None else None
        decline_length = r.randint(2, 5)
        stop_after = plan.get("stop_after")  # nombre d'éléments puis arrêt (scénarios scriptés)
        dates = plan.get("dates")

        enrollment = Enrollment(user=user, course_id=course.id, enrolled_at=start, last_activity_at=start)
        self.enrollments.append(enrollment)
        self.event(user, "enroll", course.id, None, start)

        position, last, declining, decline_sessions = 0, start, False, 0
        day = start
        fails: dict[int, int] = {}
        done_lessons: set[int] = set()
        passed_quizzes: set[int] = set()
        base_p = 0.1 + 0.55 * b.motivation * (0.5 + 0.5 * b.regularity)
        date_iter = iter(dates) if dates else None

        while position < total:
            if date_iter is not None:
                day = next(date_iter, None)
                if day is None:
                    break
            else:
                day = day + timedelta(days=1)
                if day >= self.now:
                    break
                weekend = day.weekday() >= 5
                p = base_p * ((1 + 2.4 * b.weekend) if weekend else (1 - 0.7 * b.weekend))
                if declining:
                    p *= max(0.04, 0.5 * 0.7 ** decline_sessions)
                if r.random() > min(0.95, p):
                    continue
            weekend = day.weekday() >= 5
            hour = r.randint(9, 17) if weekend else (r.randint(6, 8) if r.random() < 0.2 else r.randint(18, 22))
            t = day.replace(hour=hour, minute=r.randint(0, 59), second=r.randint(0, 59))
            if t >= self.now:
                t = self.now - timedelta(minutes=r.randint(10, 90))
            if t <= last:
                t = last + timedelta(minutes=r.randint(30, 180))
            if t >= self.now:
                break

            if decline_from is not None and position >= decline_from and not declining:
                declining = True
            if declining:
                decline_sessions += 1
                if decline_sessions > decline_length:
                    break
            mean_items = 0.4 + 0.45 * b.hours_factor + 0.7 * b.motivation
            n_items = 1 if declining else max(1, min(4, int(r.expovariate(1 / mean_items)) + 1))
            if plan.get("items_per_session"):
                n_items = plan["items_per_session"]
            for _ in range(n_items):
                if position >= total or (stop_after is not None and position >= stop_after):
                    break
                item = course.items[position]
                if item["type"] == "lesson":
                    t, completed = self.lesson_session(user, course, item, t, b, declining, plan)
                    if completed:
                        done_lessons.add(item["id"])
                        position += 1
                    else:
                        break  # leçon non validée : l'apprenant y reviendra à la prochaine session
                else:
                    t, passed = self.quiz_session(user, course, item, t, b, declining, fails.get(item["id"], 0), plan)
                    if passed:
                        passed_quizzes.add(item["id"])
                        position += 1
                    else:
                        fails[item["id"]] = fails.get(item["id"], 0) + 1
                        if fails[item["id"]] >= 3 and not declining:
                            declining = True
                        break
                last = t
            if stop_after is not None and position >= stop_after:
                break

        quiz_ids = {it["id"] for it in course.items if it["type"] == "quiz"}
        lesson_ids = {it["id"] for it in course.items if it["type"] == "lesson"}
        completed = done_lessons >= lesson_ids and passed_quizzes >= quiz_ids
        enrollment.progress = round((len(done_lessons) + len(passed_quizzes)) / max(1, total), 4)
        enrollment.last_activity_at = last
        if completed:
            enrollment.status = Enrollment.Status.COMPLETED
            enrollment.completed_at = last
            if r.random() < 0.6:
                self.add_review(user, course, b, last)
            return last, "completed"
        if declining and r.random() < 0.15:
            self.add_review(user, course, b, last, low=True)
        if (self.now - last).days > 21:
            return last, "dropped"
        return last, "ongoing"

    def add_review(self, user, course, b, when, low=False):
        r = self.rng
        mean = 2.2 if low else 4.4 - 0.8 * course.difficulty + 0.6 * (b.motivation - 0.5)
        rating = int(min(5, max(1, round(r.gauss(mean, 0.7)))))
        created = min(self.now - timedelta(minutes=5), when + timedelta(hours=r.randint(1, 30)))
        self.reviews.append(Review(user=user, course_id=course.id, rating=rating, comment=r.choice(S.REVIEW_COMMENTS[rating]), created_at=created))

    def event(self, user, kind, course_id, lesson_id, when, value=None, metadata=None):
        self.events.append(LearningEvent(
            user=user, event_type=kind, course_id=course_id, lesson_id=lesson_id, value=value,
            metadata=metadata or {}, created_at=when,
        ))

    def lesson_session(self, user, course, item, t, b, declining, plan):
        r = self.rng
        lesson_id = item["id"]
        self.event(user, "lesson_open", course.id, lesson_id, t)
        t += timedelta(seconds=r.randint(5, 40))
        duration = item["minutes"] * 60
        hard = course.hard_module is not None and item["module"] == course.hard_module + 1
        watched = 0
        if item["video"]:
            self.event(user, "video_play", course.id, lesson_id, t, metadata={"position": 0})
            if declining or r.random() < b.hurried * 0.8:
                fraction = r.uniform(0.15, 0.7) if declining else r.uniform(0.45, 0.85)
            else:
                fraction = r.uniform(0.88, 1.0)
            fraction = plan.get("video_fraction", fraction)
            watched = int(duration * fraction)
            position = 0
            while position < watched:
                chunk = min(watched - position, r.randint(90, 240))
                position += chunk
                t += timedelta(seconds=chunk)
                self.event(user, "video_progress", course.id, lesson_id, t, value=chunk,
                           metadata={"position": position, "percent": round(100 * position / duration)})
                if r.random() < (0.35 if hard else 0.12):
                    self.event(user, "video_seek", course.id, lesson_id, t, value=-30, metadata={"position": max(0, position - 30)})
            if r.random() < 0.5 or fraction < 0.88:
                self.event(user, "video_pause", course.id, lesson_id, t, metadata={"position": position})
            if fraction >= 0.88:
                self.event(user, "video_complete", course.id, lesson_id, t)
        reading = r.randint(60, 420)
        t += timedelta(seconds=reading)
        self.event(user, "lesson_time", course.id, lesson_id, t, value=reading)
        completed = (r.random() < 0.97) if not declining else (r.random() < 0.25)
        completed = plan.get("complete_lessons", completed)
        key = (user.id, lesson_id)
        entry = self.progress.setdefault(key, {"watched": 0, "position": 0, "completed_at": None})
        entry["watched"] += watched
        entry["position"] = watched
        if completed and entry["completed_at"] is None:
            entry["completed_at"] = t
            self.event(user, "lesson_complete", course.id, lesson_id, t)
        return t + timedelta(minutes=r.randint(1, 10)), completed

    def quiz_session(self, user, course, item, t, b, declining, previous_fails, plan):
        r = self.rng
        self.event(user, "quiz_start", course.id, None, t, metadata={"quiz": item["id"]})
        hints = 1 if r.random() < 0.2 + 0.2 * (1 - b.skill) else 0
        if hints:
            self.event(user, "hint_used", course.id, None, t + timedelta(seconds=40), metadata={"quiz": item["id"]})
        hard = course.hard_module is not None and item["module"] == course.hard_module + 1
        base = 100 * b.skill - 15 * course.difficulty + 12 * previous_fails + r.gauss(11, 9)
        if declining:
            base -= 18
        if hard:
            base -= 8
        if "quiz_score" in plan:
            base = plan["quiz_score"] + 10 * previous_fails
        questions = item["questions"]
        n = len(questions)
        n_correct = int(min(n, max(0, round(base / 100 * n))))
        correct_set = set(r.sample(range(n), n_correct))
        answers = []
        for index, q in enumerate(questions):
            right = [c for c in q["choices"] if c[1]]
            wrong = [c for c in q["choices"] if not c[1]]
            chosen = r.choice(right) if index in correct_set else r.choice(wrong)
            answers.append((q["id"], chosen[0], chosen[1]))
        score = round(100 * n_correct / n, 1)
        duration = r.randint(120, 600)
        t += timedelta(seconds=duration)
        attempt = QuizAttempt(
            user=user, quiz_id=item["id"], score=score, correct_count=n_correct, total=n, passed=score >= item["pass"],
            hints_used=hints, duration_seconds=duration, submitted_at=t,
        )
        self.attempts.append((attempt, answers))
        self.event(user, "quiz_submit", course.id, None, t, value=score, metadata={"quiz": item["id"]})
        return t + timedelta(minutes=r.randint(1, 8)), attempt.passed

    # ------------------------------------------------------------------ scénarios
    def scripted_user(self, first, last, email, goal, level, hours, interests, joined_days):
        user = User.objects.create(
            email=email, first_name=first, last_name=last, role=User.Role.LEARNER, password=self.password_hash,
            date_joined=self.ago(joined_days, hour=10),
        )
        LearnerProfile.objects.filter(user=user).delete()  # recréé ci-dessous avec les bons centres d'intérêt
        self.create_profiles([user], [goal], [level], [hours], [interests])
        return user

    def spread_days(self, start_days_ago: float, end_days_ago: float, count: int) -> list[datetime]:
        if count <= 1:
            return [self.ago(end_days_ago)]
        step = (start_days_ago - end_days_ago) / (count - 1)
        return [self.ago(start_days_ago - i * step).replace(hour=0) for i in range(count)]

    def create_scripted_learners(self):
        good = Behaviour(motivation=0.9, regularity=0.85, weekend=0.15, hurried=0.05, skill=0.86, hours_factor=1.0)
        weak = Behaviour(motivation=0.3, regularity=0.3, weekend=0.2, hurried=0.7, skill=0.6, hours_factor=0.6)

        # Aminata : apprenante de démonstration, régulière mais en pause sur les statistiques.
        aminata = self.scripted_user("Aminata", "Ouédraogo", "aminata@learningdata.app", "data_analyst", "beginner", "3-5",
                                     ["Python", "Statistiques", "Visualisation"], 54)
        py, st, pd_ = self.courses["python"], self.courses["stats"], self.courses["pandas"]
        self.simulate_enrollment(aminata, py, self.ago(53), good, {"drop": False, "dates": self.spread_days(52, 22, 20), "items_per_session": 1, "video_fraction": 0.95, "complete_lessons": True, "quiz_score": 88})
        self.simulate_enrollment(aminata, st, self.ago(20), good, {"drop": False, "dates": self.spread_days(19, 5, 6), "items_per_session": 1, "stop_after": 6, "video_fraction": 0.93, "complete_lessons": True, "quiz_score": 90})
        self.simulate_enrollment(aminata, pd_, self.ago(7), good, {"drop": False, "dates": self.spread_days(6, 1, 2), "items_per_session": 1, "stop_after": 2, "video_fraction": 0.96, "complete_lessons": True})
        self.aminata = aminata

        # Moussa : décroche sur les statistiques (scénario de la fiche apprenant).
        moussa = self.scripted_user("Moussa", "Sawadogo", "moussa.sawadogo@mail.com", "data_analyst", "beginner", "3-5",
                                    ["Python", "Data", "Excel"], 55)
        self.simulate_enrollment(moussa, py, self.ago(54), weak, {"drop": False, "dates": self.spread_days(53, 30, 26), "items_per_session": 1, "video_fraction": 0.9, "complete_lessons": True, "quiz_score": 79})
        self.simulate_enrollment(moussa, st, self.ago(28), weak, {"drop": True, "drop_at": 3, "dates": self.spread_days(27, 9, 6), "items_per_session": 1, "video_fraction": 0.35, "quiz_score": 50})
        self.simulate_enrollment(moussa, pd_, self.ago(18), weak, {"drop": True, "drop_at": 0, "dates": [self.ago(16)], "items_per_session": 1, "video_fraction": 0.25, "complete_lessons": False})
        self.moussa = moussa

        others = [
            ("Awa", "Traoré", "awa.traore@mail.com", "ai", "ml", 30, [self.ago(28), self.ago(24), self.ago(12)], 2, 0.4),
            ("Fatou", "Diallo", "fatou.diallo@mail.com", "data_analyst", "pandas", 34, [self.ago(33), self.ago(26), self.ago(19), self.ago(14), self.ago(7)], 5, 0.4),
            ("Ibrahim", "Compaoré", "ibrahim.compaore@mail.com", "developer", "python", 40, [self.ago(39), self.ago(33), self.ago(25), self.ago(20), self.ago(12), self.ago(6)], 8, 0.6),
        ]
        for first, last, email, goal, key, joined, dates, stop, fraction in others:
            user = self.scripted_user(first, last, email, goal, "beginner", "1-2", S.GOAL_INTERESTS[goal][:3], joined)
            self.simulate_enrollment(user, self.courses[key], self.ago(joined - 1), weak, {"drop": True, "drop_at": max(1, stop - 2), "dates": dates, "items_per_session": 2, "stop_after": stop, "video_fraction": fraction})

        yasmine = self.scripted_user("Yasmine", "Dao", "yasmine.dao@mail.com", "career", "beginner", "1-2", ["Excel", "Communication"], 168)
        User.objects.filter(pk=yasmine.pk).update(status=User.Status.SUSPENDED, last_login=self.ago(62))

    # ------------------------------------------------------------------ écriture
    def flush(self):
        Enrollment.objects.bulk_create(self.enrollments, batch_size=1000)
        Review.objects.bulk_create(self.reviews, batch_size=1000, ignore_conflicts=True)
        lesson_progress = [
            LessonProgress(
                user_id=user_id, lesson_id=lesson_id, completed=entry["completed_at"] is not None,
                completed_at=entry["completed_at"], watched_seconds=entry["watched"], last_position_seconds=entry["position"],
            )
            for (user_id, lesson_id), entry in self.progress.items()
        ]
        LessonProgress.objects.bulk_create(lesson_progress, batch_size=2000)
        attempts = QuizAttempt.objects.bulk_create([a for a, _ in self.attempts], batch_size=1000)
        answers = [
            AttemptAnswer(attempt=attempt, question_id=q, choice_id=c, is_correct=ok)
            for attempt, (_, rows) in zip(attempts, self.attempts)
            for q, c, ok in rows
        ]
        AttemptAnswer.objects.bulk_create(answers, batch_size=5000)
        self.events.sort(key=lambda e: e.created_at)
        LearningEvent.objects.bulk_create(self.events, batch_size=5000)

    def create_admin_history(self):
        r = self.rng
        issa, mariam = self.instructors["issa"], self.instructors["mariam"]

        def log(actor, action, description, days, ip):
            entry = ActivityLog.objects.create(
                actor=actor, actor_label=actor.full_name if actor else ("Système" if action == "system" else "Inconnu"),
                action=action, description=description, ip_address=ip,
            )
            ActivityLog.objects.filter(pk=entry.pk).update(created_at=self.ago(days))

        log(self.admin, "update", "Paramètres modifiés — seuil de risque élevé : 75 % → 70 %", 0.05, "41.203.12.8")
        log(issa, "create", "Nouveau cours « Deep learning : premiers pas »", 3.1, "102.67.3.21")
        log(issa, "update", "Cours « Deep learning : premiers pas » soumis pour validation", 3.0, "102.67.3.21")
        log(mariam, "update", "Cours « Communiquer avec les données » soumis pour validation", 0.2, "196.28.4.90")
        log(self.admin, "update", "Compte de Yasmine Dao modifié (statut → suspendu)", 0.3, "41.203.12.8")
        log(mariam, "login", "Connexion réussie", 0.5, "196.28.4.90")
        log(None, "system", "Rappels automatiques : 214 apprenant(s), 3 formateur(s), 0 résumé(s)", 0.6, None)
        log(None, "create", "Création du compte formateur karim.bationo@learningdata.app", 2.0, "154.66.7.12")
        for i in range(3):
            log(None, "login", "Tentative de connexion échouée sur admin@learningdata.app", 1.6 - i * 0.01, "88.12.45.3")
        for day in range(1, 10):
            for actor in (self.admin, issa, mariam, self.instructors[r.choice(list(self.instructors))]):
                if r.random() < 0.6:
                    log(actor, "login", "Connexion réussie", day + r.random() * 0.5, f"41.203.{r.randint(1, 250)}.{r.randint(1, 250)}")

        def notif(user, kind, title, body, link, days, read=False):
            n = Notification.objects.create(user=user, kind=kind, title=title, body=body, link=link, is_read=read)
            Notification.objects.filter(pk=n.pk).update(created_at=self.ago(days))
            return n

        notif(self.aminata, "reminder", "Reprends « Statistiques pour la data »",
              "Tu n'as pas avancé depuis 5 jours. Une leçon de 10 minutes suffit pour reprendre le rythme !",
              "/apprenant/apprendre/statistiques-pour-la-data", 0.3)
        notif(self.aminata, "recommendation", "Nouvelles recommandations pour toi",
              "Trois cours correspondent à ton objectif « data analyst ».", "/apprenant/recommandations", 2)
        notif(self.aminata, "achievement", "Bravo ! Tu as terminé « Introduction à Python »",
              "Ton certificat est disponible.", "/apprenant/certificats/introduction-a-python", 21, read=True)

        reminder = notif(self.moussa, "message", "Mariam Kaboré t'encourage à reprendre ton cours",
                         "Bonjour Moussa, tu étais bien parti sur les statistiques ! Reprends à la leçon sur l'écart-type, je reste disponible si tu as des questions.",
                         "/apprenant/apprendre/statistiques-pour-la-data", 8)
        congrats = notif(self.moussa, "message", "Nouveau message de Issa Traoré",
                         "Félicitations pour ton cours Python, continue comme ça !", "/apprenant", 16, read=True)
        for instructor, kind, message, notification, days in (
            (mariam, "reminder", reminder.body, reminder, 8),
            (issa, "message", congrats.body, congrats, 16),
        ):
            course = self.courses["stats" if instructor == mariam else "python"]
            item = Intervention.objects.create(
                instructor=instructor, learner=self.moussa, course_id=course.id, kind=kind, message=message, notification=notification,
            )
            Intervention.objects.filter(pk=item.pk).update(created_at=self.ago(days))
        for admin_note in ("Nouveau cours à valider",):
            notif(self.admin, "alert", admin_note, "« Deep learning : premiers pas » par Issa Traoré", "/admin/validation", 3)
            notif(self.admin, "alert", admin_note, "« Communiquer avec les données » par Mariam Kaboré", "/admin/validation", 0.2)
