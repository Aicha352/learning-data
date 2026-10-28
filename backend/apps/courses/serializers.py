from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    Category,
    Choice,
    Course,
    Enrollment,
    Lesson,
    Module,
    Question,
    Quiz,
    Review,
    Tag,
)


# --- Référentiels ----------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    course_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "color", "description", "course_count"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class CategoryMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "color"]


class InstructorMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)
    avatar_color = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "initials", "avatar_color", "headline"]


# --- Catalogue public -------------------------------------------------------

class CourseListSerializer(serializers.ModelSerializer):
    category = CategoryMiniSerializer(read_only=True)
    instructor = InstructorMiniSerializer(read_only=True)
    tags = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    level_label = serializers.CharField(source="get_level_display", read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True, default=0)
    review_count = serializers.IntegerField(read_only=True, default=0)
    avg_rating = serializers.FloatField(read_only=True, default=None)
    lesson_count = serializers.IntegerField(read_only=True, default=0)
    duration_minutes = serializers.IntegerField(source="total_minutes", read_only=True, default=0)
    is_new = serializers.SerializerMethodField()
    match_score = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "slug", "title", "subtitle", "category", "level", "level_label", "tags", "cover_color",
            "instructor", "enrolled_count", "review_count", "avg_rating", "lesson_count", "duration_minutes",
            "published_at", "is_new", "match_score", "is_enrolled",
        ]

    def get_is_new(self, obj) -> bool:
        return bool(obj.published_at and (timezone.now() - obj.published_at).days <= 45)

    def get_match_score(self, obj) -> float | None:
        scores = self.context.get("match_scores") or {}
        return scores.get(obj.id)

    def get_is_enrolled(self, obj) -> bool:
        return obj.id in (self.context.get("enrolled_ids") or set())


class LessonOutlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["id", "title", "order", "duration_minutes"]


class ModuleOutlineSerializer(serializers.ModelSerializer):
    lessons = LessonOutlineSerializer(many=True, read_only=True)
    has_quiz = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ["id", "title", "description", "order", "lessons", "has_quiz", "duration_minutes"]

    def get_has_quiz(self, obj) -> bool:
        return hasattr(obj, "quiz")

    def get_duration_minutes(self, obj) -> int:
        return sum(lesson.duration_minutes for lesson in obj.lessons.all())


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_initials = serializers.CharField(source="user.initials", read_only=True)
    user_color = serializers.CharField(source="user.avatar_color", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "rating", "comment", "created_at", "user_name", "user_initials", "user_color"]
        read_only_fields = ["id", "created_at", "user_name", "user_initials", "user_color"]


class CourseDetailSerializer(CourseListSerializer):
    modules = ModuleOutlineSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    enrollment = serializers.SerializerMethodField()
    recommendation = serializers.SerializerMethodField()
    my_review = serializers.SerializerMethodField()

    class Meta(CourseListSerializer.Meta):
        fields = CourseListSerializer.Meta.fields + [
            "description", "learning_outcomes", "prerequisites", "modules", "reviews",
            "enrollment", "recommendation", "my_review", "status",
        ]

    def get_reviews(self, obj):
        reviews = obj.reviews.select_related("user")[:6]
        return ReviewSerializer(reviews, many=True).data

    def get_enrollment(self, obj):
        return self.context.get("enrollment")

    def get_recommendation(self, obj):
        return self.context.get("recommendation")

    def get_my_review(self, obj):
        review = self.context.get("my_review")
        return ReviewSerializer(review).data if review else None


class ReviewWriteSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)


# --- Espace d'apprentissage ---------------------------------------------------

class QuizAnswerSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    choice = serializers.IntegerField(allow_null=True, required=False)


class QuizSubmitSerializer(serializers.Serializer):
    answers = QuizAnswerSerializer(many=True)
    hints_used = serializers.IntegerField(min_value=0, max_value=100, default=0)
    duration_seconds = serializers.IntegerField(min_value=0, max_value=24 * 3600, default=0)


class NoteSerializer(serializers.Serializer):
    content = serializers.CharField(allow_blank=True, max_length=20000)


# --- Espace formateur -----------------------------------------------------------

class InstructorCourseListSerializer(serializers.ModelSerializer):
    category = CategoryMiniSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    level_label = serializers.CharField(source="get_level_display", read_only=True)
    instructor = InstructorMiniSerializer(read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True, default=0)
    completed_count = serializers.IntegerField(read_only=True, default=0)
    avg_rating = serializers.FloatField(read_only=True, default=None)
    lesson_count = serializers.IntegerField(read_only=True, default=0)
    duration_minutes = serializers.IntegerField(source="total_minutes", read_only=True, default=0)
    completion_rate = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "slug", "title", "subtitle", "status", "status_label", "category", "level", "level_label",
            "cover_color", "instructor", "enrolled_count", "completed_count", "completion_rate", "avg_rating",
            "lesson_count", "duration_minutes", "updated_at", "submitted_at", "published_at", "review_comment",
        ]

    def get_completion_rate(self, obj) -> float | None:
        enrolled = getattr(obj, "enrolled_count", 0)
        if not enrolled:
            return None
        return round(getattr(obj, "completed_count", 0) / enrolled, 3)


class InstructorCourseWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    tags = serializers.ListField(child=serializers.CharField(max_length=60), required=False, max_length=15)
    learning_outcomes = serializers.ListField(child=serializers.CharField(max_length=200), required=False, max_length=12)

    class Meta:
        model = Course
        fields = [
            "title", "subtitle", "description", "category", "level", "tags", "learning_outcomes",
            "prerequisites", "cover_color",
        ]

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError("Le titre doit contenir au moins 5 caractères.")
        return value

    def validate_cover_color(self, value):
        if value and (len(value) != 7 or not value.startswith("#")):
            raise serializers.ValidationError("Couleur invalide (format #RRGGBB).")
        return value

    def _set_tags(self, course, names):
        tags = []
        for name in names:
            name = name.strip()
            if not name:
                continue
            tag = Tag.objects.filter(name__iexact=name).first() or Tag.objects.create(name=name.lower())
            tags.append(tag)
        course.tags.set(tags)

    @transaction.atomic
    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        validated_data["learning_outcomes"] = [o.strip() for o in validated_data.get("learning_outcomes", []) if o.strip()]
        course = Course.objects.create(instructor=self.context["request"].user, **validated_data)
        self._set_tags(course, tags)
        return course

    @transaction.atomic
    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        if "learning_outcomes" in validated_data:
            validated_data["learning_outcomes"] = [o.strip() for o in validated_data["learning_outcomes"] if o.strip()]
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if tags is not None:
            self._set_tags(instance, tags)
        return instance


class ChoiceWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ["id", "text", "is_correct"]
        read_only_fields = ["id"]


class QuestionWriteSerializer(serializers.ModelSerializer):
    choices = ChoiceWriteSerializer(many=True)
    lesson = serializers.PrimaryKeyRelatedField(queryset=Lesson.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Question
        fields = ["id", "text", "code", "topic", "hint", "explanation", "lesson", "choices"]
        read_only_fields = ["id"]

    def validate_choices(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Chaque question doit avoir au moins 2 réponses.")
        if not any(choice.get("is_correct") for choice in value):
            raise serializers.ValidationError("Indique au moins une bonne réponse.")
        return value


class QuizWriteSerializer(serializers.ModelSerializer):
    questions = QuestionWriteSerializer(many=True)

    class Meta:
        model = Quiz
        fields = ["id", "title", "pass_score", "questions"]
        read_only_fields = ["id"]

    def validate_questions(self, value):
        if not value:
            raise serializers.ValidationError("Ajoute au moins une question.")
        module = self.context["module"]
        for question in value:
            lesson = question.get("lesson")
            if lesson is not None and lesson.module_id != module.id:
                raise serializers.ValidationError("La leçon liée doit appartenir à ce module.")
        return value

    @transaction.atomic
    def save_for_module(self, module):
        data = self.validated_data
        quiz, _ = Quiz.objects.update_or_create(
            module=module, defaults={"title": data["title"], "pass_score": data["pass_score"]}
        )
        quiz.questions.all().delete()
        for q_index, question in enumerate(data["questions"], start=1):
            choices = question.pop("choices")
            q = Question.objects.create(quiz=quiz, order=q_index, **question)
            Choice.objects.bulk_create(
                [Choice(question=q, order=i, text=c["text"], is_correct=c.get("is_correct", False)) for i, c in enumerate(choices, start=1)]
            )
        return quiz


class QuizReadSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ["id", "title", "pass_score", "questions"]

    def get_questions(self, obj):
        return [
            {
                "id": q.id,
                "text": q.text,
                "code": q.code,
                "topic": q.topic,
                "hint": q.hint,
                "explanation": q.explanation,
                "lesson": q.lesson_id,
                "choices": [{"id": c.id, "text": c.text, "is_correct": c.is_correct} for c in q.choices.all()],
            }
            for q in obj.questions.all()
        ]


class LessonWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["id", "module", "title", "order", "content", "video_url", "duration_minutes"]
        read_only_fields = ["id"]
        extra_kwargs = {"order": {"required": False}}

    def validate_duration_minutes(self, value):
        if value < 1 or value > 300:
            raise serializers.ValidationError("La durée doit être comprise entre 1 et 300 minutes.")
        return value


class ModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ["id", "course", "title", "description", "order"]
        read_only_fields = ["id"]
        extra_kwargs = {"order": {"required": False}}


class InstructorModuleSerializer(serializers.ModelSerializer):
    lessons = LessonWriteSerializer(many=True, read_only=True)
    quiz = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ["id", "title", "description", "order", "lessons", "quiz"]

    def get_quiz(self, obj):
        quiz = getattr(obj, "quiz", None)
        if not quiz:
            return None
        return {"id": quiz.id, "title": quiz.title, "pass_score": quiz.pass_score, "question_count": quiz.questions.count()}


class InstructorCourseDetailSerializer(InstructorCourseListSerializer):
    tags = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    modules = InstructorModuleSerializer(many=True, read_only=True)
    checklist = serializers.SerializerMethodField()

    class Meta(InstructorCourseListSerializer.Meta):
        fields = InstructorCourseListSerializer.Meta.fields + [
            "description", "tags", "learning_outcomes", "prerequisites", "modules", "checklist",
        ]

    def get_checklist(self, obj):
        from .services import course_checklist

        return course_checklist(obj)


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Enrollment
        fields = ["id", "course", "status", "status_label", "progress", "enrolled_at", "completed_at", "last_activity_at"]
