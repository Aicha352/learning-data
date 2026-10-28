from django.core.management.base import BaseCommand

from apps.ml.models import TrainingRun
from apps.ml.pipeline import start_training


class Command(BaseCommand):
    help = "Réentraîne tous les modèles (recommandations, abandon, profils) et met à jour les prédictions."

    def handle(self, *args, **options):
        self.stdout.write("Lancement du pipeline d'entraînement…")
        run = start_training(user=None, trigger="schedule", background=False)
        for step in run.steps:
            icon = "✔" if step["status"] == "success" else "✖"
            self.stdout.write(f"  {icon} {step['label']} : {step.get('detail', '')}")
        if run.status == TrainingRun.Status.SUCCESS:
            self.stdout.write(self.style.SUCCESS(f"Terminé en {run.duration_seconds} s."))
        else:
            self.stderr.write(self.style.ERROR("Échec de l'entraînement :"))
            self.stderr.write(run.error)
