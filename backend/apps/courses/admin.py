from django.contrib import admin

from .models import (
    Category,
    Choice,
    Course,
    Enrollment,
    Lesson,
    Module,
    Question,
    Quiz,
    QuizAttempt,
    Review,
    Tag,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "color"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ["name"]


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "level", "instructor", "status", "published_at"]
    list_filter = ["status", "category", "level"]
    search_fields = ["title", "description"]
    prepopulated_fields = {"slug": ["title"]}
    filter_horizontal = ["tags"]
    inlines = [ModuleInline]


class LessonInline(admin.StackedInline):
    model = Lesson
    extra = 0


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ["title", "course", "order"]
    inlines = [LessonInline]


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 0


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["text", "quiz", "topic"]
    inlines = [ChoiceInline]


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ["title", "module", "pass_score"]


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ["user", "course", "status", "progress", "enrolled_at", "last_activity_at"]
    list_filter = ["status"]
    raw_id_fields = ["user", "course"]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ["user", "quiz", "score", "passed", "submitted_at"]
    raw_id_fields = ["user", "quiz"]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["user", "course", "rating", "created_at"]
    raw_id_fields = ["user", "course"]
