from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import instructor_views, learn_views, views

router = DefaultRouter()
router.register("instructor/courses", instructor_views.InstructorCourseViewSet, basename="instructor-courses")
router.register("instructor/modules", instructor_views.ModuleViewSet, basename="instructor-modules")
router.register("instructor/lessons", instructor_views.LessonViewSet, basename="instructor-lessons")

urlpatterns = [
    # Catalogue public
    path("categories/", views.CategoryListView.as_view(), name="categories"),
    path("tags/", views.TagListView.as_view(), name="tags"),
    path("courses/", views.CourseListView.as_view(), name="courses"),
    path("courses/<slug:slug>/", views.CourseDetailView.as_view(), name="course-detail"),
    path("courses/<slug:slug>/enroll/", views.EnrollView.as_view(), name="course-enroll"),
    path("courses/<slug:slug>/review/", views.ReviewView.as_view(), name="course-review"),
    # Espace d'apprentissage
    path("learn/enrollments/", learn_views.MyEnrollmentsView.as_view(), name="my-enrollments"),
    path("learn/courses/<slug:slug>/", learn_views.LearnCourseView.as_view(), name="learn-course"),
    path("learn/courses/<slug:slug>/certificate/", learn_views.CertificateView.as_view(), name="certificate"),
    path("learn/lessons/<int:pk>/", learn_views.LessonDetailView.as_view(), name="learn-lesson"),
    path("learn/lessons/<int:pk>/complete/", learn_views.LessonCompleteView.as_view(), name="lesson-complete"),
    path("learn/lessons/<int:pk>/note/", learn_views.LessonNoteView.as_view(), name="lesson-note"),
    path("learn/quizzes/<int:pk>/", learn_views.QuizDetailView.as_view(), name="learn-quiz"),
    path("learn/quizzes/<int:pk>/submit/", learn_views.QuizSubmitView.as_view(), name="quiz-submit"),
    path("learn/attempts/<int:pk>/", learn_views.AttemptResultView.as_view(), name="attempt-result"),
    # Espace formateur
    path("instructor/course-options/", instructor_views.InstructorCourseLearnersView.as_view(), name="instructor-course-options"),
    path("", include(router.urls)),
]
