from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.core.choices import Level
from apps.core.utils import unique_slug


class Category(models.Model):
    name = models.CharField("nom", max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True)
    color = models.CharField("couleur", max_length=7, default="#2D5BE3")
    description = models.CharField(max_length=240, blank=True)

    class Meta:
        verbose_name = "catégorie"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Category, self.name, self.pk)
        super().save(*args, **kwargs)


class Tag(models.Model):
    name = models.CharField("nom", max_length=60, unique=True)
    slug = models.SlugField(max_length=70, unique=True)

    class Meta:
        verbose_name = "mot-clé"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Tag, self.name, self.pk)
        super().save(*args, **kwargs)


class CourseQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=Course.Status.PUBLISHED)


class Course(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PENDING = "pending", "En attente de validation"
        CHANGES_REQUESTED = "changes_requested", "Modifications demandées"
        PUBLISHED = "published", "Publié"
        REJECTED = "rejected", "Refusé"

    title = models.CharField("titre", max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    subtitle = models.CharField("sous-titre", max_length=240, blank=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="courses")
    tags = models.ManyToManyField(Tag, blank=True, related_name="courses")
    level = models.CharField("niveau", max_length=20, choices=Level.choices, default=Level.BEGINNER)
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="taught_courses")
    learning_outcomes = models.JSONField("ce que l'on apprend", default=list, blank=True)
    prerequisites = models.CharField("prérequis", max_length=240, blank=True)
    cover_color = models.CharField(max_length=7, default="#EAF0FF")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    review_comment = models.TextField("commentaire de validation", blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_courses"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CourseQuerySet.as_manager()

    class Meta:
        verbose_name = "cours"
        verbose_name_plural = "cours"
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Course, self.title, self.pk)
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def is_published(self) -> bool:
        return self.status == self.Status.PUBLISHED


class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField("titre", max_length=160)
    description = models.CharField(max_length=300, blank=True)
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Module {self.order} · {self.title}"


class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField("titre", max_length=160)
    order = models.PositiveSmallIntegerField(default=1)
    content = models.TextField("contenu", blank=True)
    video_url = models.URLField("vidéo", blank=True)
    duration_minutes = models.PositiveSmallIntegerField("durée (min)", default=10)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title

    @property
    def course(self) -> Course:
        return self.module.course


class Quiz(models.Model):
    module = models.OneToOneField(Module, on_delete=models.CASCADE, related_name="quiz")
    title = models.CharField(max_length=160)
    pass_score = models.PositiveSmallIntegerField(
        "score minimum (%)", default=70, validators=[MinValueValidator(1), MaxValueValidator(100)]
    )

    class Meta:
        verbose_name = "quiz"
        verbose_name_plural = "quiz"

    def __str__(self):
        return self.title


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    text = models.CharField("question", max_length=400)
    code = models.TextField("extrait de code", blank=True)
    topic = models.CharField("notion évaluée", max_length=120, blank=True)
    hint = models.CharField("indice", max_length=300, blank=True)
    explanation = models.CharField("explication", max_length=500, blank=True)
    lesson = models.ForeignKey(Lesson, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions")
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text


class Choice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    text = models.CharField(max_length=300)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text


class Enrollment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "En cours"
        COMPLETED = "completed", "Terminé"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    progress = models.FloatField(default=0.0)  # entre 0 et 1
    enrolled_at = models.DateTimeField(default=timezone.now, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = "inscription"
        constraints = [models.UniqueConstraint(fields=["user", "course"], name="unique_enrollment")]
        ordering = ["-last_activity_at", "-enrolled_at"]

    def __str__(self):
        return f"{self.user} → {self.course}"


class LessonProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress")
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    watched_seconds = models.PositiveIntegerField(default=0)
    last_position_seconds = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "lesson"], name="unique_lesson_progress")]


class QuizAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_attempts")
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    score = models.FloatField(default=0)  # en %
    correct_count = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    passed = models.BooleanField(default=False)
    hints_used = models.PositiveSmallIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    submitted_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-submitted_at"]


class AttemptAnswer(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    choice = models.ForeignKey(Choice, null=True, blank=True, on_delete=models.SET_NULL)
    is_correct = models.BooleanField(default=False)


class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "avis"
        verbose_name_plural = "avis"
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "course"], name="unique_review")]


class LessonNote(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_notes")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="notes")
    content = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "lesson"], name="unique_lesson_note")]
