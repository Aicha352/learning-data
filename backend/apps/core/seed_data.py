"""Contenu de démonstration : catégories, formateurs, cours, quiz.

Les cours « vitrines » (Python, Statistiques, Pandas, SQL, Machine Learning, Visualisation)
ont de vrais quiz. Les autres reçoivent des quiz générés automatiquement.
"""

CATEGORIES = [
    ("data-science", "Data Science", "#2D5BE3", "#EAF0FF", "Analyser des données pour aider à décider."),
    ("programmation", "Programmation", "#7C3AED", "#F3E8FF", "Écrire du code clair et utile."),
    ("intelligence-artificielle", "Intelligence artificielle", "#F59E0B", "#FFF4DE", "Machine learning et IA moderne."),
    ("bases-de-donnees", "Bases de données", "#16A34A", "#E7F6EC", "Stocker et interroger les données."),
    ("gestion-de-projet", "Gestion de projet", "#0EA5E9", "#E0F2FE", "Planifier, piloter, livrer."),
    ("bureautique", "Bureautique", "#DB2777", "#FCE7F3", "Les outils du quotidien au travail."),
    ("communication", "Communication", "#0D9488", "#CCFBF1", "Convaincre à l'écrit comme à l'oral."),
    ("entrepreneuriat", "Entrepreneuriat", "#B45309", "#FEF3C7", "Lancer et développer son activité."),
]

INSTRUCTORS = {
    "issa": ("Issa", "Traoré", "issa.traore@learningdata.app", "Data scientist"),
    "mariam": ("Mariam", "Kaboré", "mariam.kabore@learningdata.app", "Data analyst"),
    "boukary": ("Boukary", "Ouédraogo", "boukary.ouedraogo@learningdata.app", "Ingénieur logiciel"),
    "fatimata": ("Fatimata", "Compaoré", "fatimata.compaore@learningdata.app", "Cheffe de projet"),
    "abdoul": ("Abdoul", "Sawadogo", "abdoul.sawadogo@learningdata.app", "Administrateur de bases de données"),
    "clarisse": ("Clarisse", "Zongo", "clarisse.zongo@learningdata.app", "Formatrice bureautique et entrepreneuriat"),
}

VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"


def L(title, content="", minutes=10, video=True):
    return {"title": title, "content": content, "minutes": minutes, "video": video}


def Q(text, choices, topic, lesson=0, code="", hint="", explanation=""):
    """La première réponse de `choices` est la bonne (elles sont mélangées au chargement)."""
    return {"text": text, "choices": choices, "topic": topic, "lesson": lesson, "code": code, "hint": hint, "explanation": explanation}


COURSES = [
    # ------------------------------------------------------------------ Python
    {
        "key": "python",
        "title": "Introduction à Python",
        "subtitle": "Les bases de la programmation avec le langage le plus utilisé en data.",
        "description": "Un premier cours pour apprendre à programmer pas à pas : variables, conditions, boucles, "
        "listes, dictionnaires et fonctions. Chaque notion est illustrée par des exemples concrets tirés du quotidien "
        "et validée par un quiz.",
        "category": "programmation", "level": "beginner", "instructor": "issa", "difficulty": 0.25,
        "tags": ["Python", "Programmation", "Data"],
        "outcomes": ["Écrire et exécuter tes premiers programmes", "Utiliser les conditions et les boucles",
                     "Manipuler listes et dictionnaires", "Créer des fonctions réutilisables"],
        "published_days_ago": 300,
        "modules": [
            ("Premiers pas avec Python", [
                L("Installer Python et Jupyter", "Python est un langage simple à lire. Dans cette leçon, tu installes Python et Jupyter Notebook, l'outil que l'on utilise pour écrire du code par petits blocs et voir le résultat tout de suite.\n\n- Télécharger Python depuis python.org\n- Lancer Jupyter avec la commande `jupyter notebook`\n- Exécuter une cellule avec Maj + Entrée", 8),
                L("Variables et types", "Une variable est une boîte qui porte un nom et contient une valeur. Python devine tout seul le type : un nombre entier (`int`), un nombre décimal (`float`), du texte (`str`) ou un booléen (`bool`).\n\n- `age = 25` crée une variable entière\n- `prix = 3.5` crée un nombre décimal\n- `type(prix)` affiche le type d'une valeur", 9),
                L("Afficher et lire des données", "La fonction `print()` affiche un résultat à l'écran et `input()` demande une information à l'utilisateur. On peut combiner du texte et des variables avec les f-strings.\n\n- `print(f\"Bonjour {nom}\")`\n- `input()` renvoie toujours du texte : pense à le convertir avec `int()`", 8),
            ], [
                Q("Quel symbole permet d'écrire un commentaire en Python ?", ["#", "//", "<!-- -->", "%"], "Syntaxe de base", 0, explanation="En Python, tout ce qui suit # sur une ligne est un commentaire."),
                Q("Quel est le type de la valeur 3.14 ?", ["float", "int", "str", "bool"], "Types de données", 1, explanation="Un nombre avec une partie décimale est un float."),
                Q("Quelle fonction affiche un texte à l'écran ?", ["print()", "input()", "show()", "echo()"], "Entrées et sorties", 2, explanation="print() affiche, input() lit une saisie."),
            ]),
            ("Conditions et boucles", [
                L("Les conditions if / else", "Une condition permet d'exécuter du code seulement si une situation est vraie. L'indentation (le décalage du code) indique ce qui fait partie du bloc.\n\n- `if note >= 10:` puis le code décalé\n- `elif` pour un autre cas, `else` pour tous les autres", 11),
                L("La boucle for", "La boucle `for` répète des instructions pour chaque élément d'une séquence. Avec `range(n)`, on répète n fois.\n\n- `for i in range(3):` répète 3 fois (i vaut 0, 1, 2)\n- `for fruit in fruits:` parcourt une liste", 10),
                L("La boucle while", "La boucle `while` répète tant qu'une condition est vraie. Attention à bien faire évoluer la condition, sinon la boucle ne s'arrête jamais.\n\n- `break` sort immédiatement de la boucle\n- `continue` passe directement au tour suivant", 10),
            ], [
                Q("Qu'affiche ce programme ?", ["grand", "petit", "Rien", "Une erreur"], "Conditions", 0, code="x = 7\nif x > 5:\n    print('grand')\nelse:\n    print('petit')", explanation="7 est supérieur à 5, la première branche est exécutée."),
                Q("Combien de fois cette boucle s'exécute-t-elle ?", ["3 fois", "2 fois", "4 fois", "Indéfiniment"], "Boucle for", 1, code="for i in range(3):\n    print(i)", hint="range(3) produit 0, 1 et 2.", explanation="range(3) contient trois valeurs : 0, 1 et 2."),
                Q("Quel mot-clé arrête immédiatement une boucle ?", ["break", "stop", "exit", "continue"], "Boucle while", 2, explanation="break sort de la boucle ; continue passe seulement au tour suivant."),
            ]),
            ("Les structures de données", [
                L("Les listes", "Une liste regroupe plusieurs valeurs dans un ordre précis. Les positions commencent à 0.\n\n- `fruits = ['mangue', 'banane']`\n- `fruits[0]` donne 'mangue'\n- `fruits.append('orange')` ajoute un élément", 12),
                L("Les dictionnaires", "Un dictionnaire associe des clés à des valeurs, comme un répertoire : on retrouve une valeur grâce à sa clé.\n\n- `d = {'nom': 'Awa', 'age': 22}`\n- `d['age']` donne 22\n- `d.keys()` liste les clés", 12),
                L("Les tuples et les ensembles", "Un tuple ressemble à une liste mais ne peut pas être modifié. Un ensemble (`set`) ne garde que des valeurs uniques.\n\n- `point = (3, 4)` est un tuple\n- `set([1, 1, 2])` donne {1, 2}", 9, video=False),
            ], [
                Q("Qu'affiche ce code ?", ["banane", "mangue", "orange", "Une erreur"], "Listes", 0, code="fruits = ['mangue', 'banane', 'orange']\nprint(fruits[1])", hint="Les positions commencent à 0.", explanation="L'indice 1 correspond au deuxième élément."),
                Q("Comment obtenir la valeur de la clé 'age' du dictionnaire d ?", ["d['age']", "d.age", "d(age)", "d[0]"], "Dictionnaires", 1, explanation="On accède à une valeur avec la syntaxe d[clé]."),
                Q("Quelle structure ne peut pas être modifiée après sa création ?", ["Le tuple", "La liste", "Le dictionnaire", "L'ensemble"], "Tuples et ensembles", 2, explanation="Le tuple est immuable."),
            ]),
            ("Les fonctions", [
                L("Définir une fonction", "Une fonction regroupe des instructions réutilisables sous un nom. On la définit avec le mot-clé `def`.\n\n- `def saluer(nom):` puis le code décalé\n- Une bonne fonction fait une seule chose", 8),
                L("Appeler une fonction", "Définir une fonction ne l'exécute pas : il faut l'appeler en écrivant son nom suivi de parenthèses.\n\n- `saluer('Awa')`\n- On peut appeler une fonction autant de fois que nécessaire", 9),
                L("Paramètres et valeur de retour", "Les paramètres sont les informations que l'on donne à la fonction. Le mot-clé `return` renvoie un résultat que l'on peut réutiliser. Un paramètre peut avoir une valeur par défaut.\n\n- `def prix_total(prix, quantite=2):`\n- `return prix * quantite`\n- Sans `return`, la fonction renvoie `None`", 11),
                L("Portée des variables", "Une variable créée dans une fonction est locale : elle n'existe que pendant l'exécution de la fonction.\n\n- Évite de modifier des variables globales\n- Passe plutôt les valeurs en paramètres", 10),
            ], [
                Q("Quel mot-clé sert à définir une fonction ?", ["def", "function", "func", "lambda"], "Définir une fonction", 0, explanation="En Python, une fonction se définit avec def."),
                Q("Qu'affiche ce programme ?", ["1000", "500", "Une erreur, quantite est manquant", "None"], "Valeurs par défaut", 2, code="def prix_total(prix, quantite=2):\n    total = prix * quantite\n    return total\n\nprint(prix_total(500))", hint="Regarde la valeur par défaut du paramètre quantite.", explanation="quantite vaut 2 par défaut : 500 × 2 = 1000."),
                Q("Que renvoie une fonction qui ne contient pas d'instruction return ?", ["None", "0", "Une chaîne vide", "Une erreur"], "Valeur de retour", 2, explanation="Sans return, Python renvoie None."),
                Q("Une variable créée dans une fonction est-elle accessible en dehors ?", ["Non, elle est locale à la fonction", "Oui, toujours", "Seulement si elle est en majuscules", "Seulement après un return"], "Portée des variables", 3, explanation="Les variables définies dans une fonction sont locales."),
            ]),
        ],
    },
    # ------------------------------------------------------------- Statistiques
    {
        "key": "stats",
        "title": "Statistiques pour la data",
        "subtitle": "Comprendre et résumer des données avec les bons indicateurs.",
        "description": "Les statistiques sont la base de toute analyse de données. Ce cours t'apprend à décrire un jeu de "
        "données, à choisir entre moyenne et médiane, à mesurer la dispersion, à comprendre les probabilités et à "
        "interpréter une corrélation sans tomber dans les pièges classiques.",
        "category": "data-science", "level": "beginner", "instructor": "mariam", "difficulty": 0.45, "hard_module": 1,
        "tags": ["Statistiques", "Probabilités", "Data"],
        "outcomes": ["Décrire un jeu de données", "Choisir le bon indicateur", "Comprendre la loi normale", "Interpréter une corrélation"],
        "published_days_ago": 280,
        "modules": [
            ("Décrire des données", [
                L("Population et échantillon", "On étudie rarement toute une population : on travaille sur un échantillon. Un bon échantillon doit être représentatif.\n\n- Population : l'ensemble étudié\n- Échantillon : la partie observée", 9),
                L("Types de variables", "Une variable peut être qualitative (une catégorie, comme une couleur) ou quantitative (un nombre, comme un âge).\n\n- Quantitative discrète : nombre d'enfants\n- Quantitative continue : taille, salaire", 10),
                L("Tableaux de fréquences", "Un tableau de fréquences compte combien de fois chaque valeur apparaît, en nombre ou en pourcentage.", 8, video=False),
            ], [
                Q("Comment appelle-t-on la partie de la population que l'on étudie ?", ["Un échantillon", "Un recensement", "Une variable", "Un quartile"], "Échantillonnage", 0, explanation="L'échantillon est la partie de la population réellement observée."),
                Q("La couleur préférée d'une personne est une variable…", ["qualitative", "quantitative continue", "quantitative discrète", "aléatoire"], "Types de variables", 1, explanation="Une couleur est une catégorie, donc une variable qualitative."),
                Q("Que donne un tableau de fréquences ?", ["Le nombre ou la part de chaque valeur", "La moyenne des valeurs", "La valeur la plus grande", "La corrélation"], "Fréquences", 2),
            ]),
            ("Moyenne, médiane et dispersion", [
                L("La moyenne et la médiane", "La moyenne additionne toutes les valeurs puis divise par leur nombre. La médiane coupe les données en deux moitiés : elle résiste mieux aux valeurs extrêmes.\n\n- Salaires 100, 120, 130, 150, 2000 : moyenne 500, médiane 130", 12),
                L("Variance et écart-type", "L'écart-type mesure à quel point les valeurs s'éloignent de la moyenne. Plus il est grand, plus les données sont dispersées.", 13),
                L("Les quartiles et la boîte à moustaches", "Les quartiles découpent les données en quatre parts égales. La boîte à moustaches les représente : la boîte contient les 50 % de valeurs centrales.", 11),
            ], [
                Q("Pour les salaires 100, 120, 130, 150 et 2000, quel indicateur décrit le mieux un salaire typique ?", ["La médiane", "La moyenne", "Le maximum", "L'étendue"], "Moyenne et médiane", 0, hint="Une valeur est très différente des autres.", explanation="La médiane n'est pas influencée par la valeur extrême 2000."),
                Q("Que mesure l'écart-type ?", ["La dispersion des valeurs autour de la moyenne", "La valeur centrale", "Le nombre de valeurs", "La valeur la plus fréquente"], "Dispersion", 1),
                Q("Dans une boîte à moustaches, que représente la boîte ?", ["Les 50 % de valeurs centrales (de Q1 à Q3)", "Toutes les valeurs", "Les valeurs extrêmes", "La moyenne plus ou moins 1"], "Quartiles", 2),
            ]),
            ("Probabilités", [
                L("Notions de probabilité", "Une probabilité mesure la chance qu'un événement se produise, entre 0 (impossible) et 1 (certain).", 10),
                L("La loi normale", "La loi normale a la forme d'une cloche. Environ 68 % des valeurs sont à moins d'un écart-type de la moyenne, 95 % à moins de deux.", 12),
            ], [
                Q("Quelle est la probabilité d'obtenir un 6 avec un dé équilibré ?", ["1/6", "1/2", "1/3", "6"], "Probabilités", 0),
                Q("Dans une loi normale, quelle part des valeurs est à moins d'un écart-type de la moyenne ?", ["Environ 68 %", "Environ 50 %", "Environ 95 %", "Environ 99,7 %"], "Loi normale", 1),
            ]),
            ("Corrélation et tests", [
                L("Corrélation et causalité", "Deux variables corrélées évoluent ensemble, mais cela ne prouve pas que l'une cause l'autre. Il peut exister une troisième variable cachée.", 11),
                L("Introduction aux tests d'hypothèse", "Un test d'hypothèse vérifie si un résultat peut s'expliquer par le hasard. Si la p-valeur est inférieure au seuil choisi (souvent 0,05), on rejette l'hypothèse nulle.", 13),
            ], [
                Q("Deux variables très corrélées signifie que…", ["elles varient ensemble, sans prouver que l'une cause l'autre", "l'une cause forcément l'autre", "elles sont indépendantes", "leurs moyennes sont égales"], "Corrélation", 0),
                Q("Une p-valeur de 0,01 avec un seuil de 0,05 conduit à…", ["rejeter l'hypothèse nulle", "accepter l'hypothèse nulle", "recommencer l'expérience", "doubler l'échantillon"], "Tests", 1),
            ]),
        ],
    },
    # ------------------------------------------------------------------ Pandas
    {
        "key": "pandas",
        "title": "Pandas : manipuler des données",
        "subtitle": "Charger, nettoyer, filtrer et regrouper des tableaux de données.",
        "description": "Pandas est la bibliothèque Python incontournable pour travailler avec des tableaux de données. Tu "
        "apprends à charger des fichiers, à nettoyer les valeurs manquantes et les doublons, à filtrer, regrouper et "
        "fusionner des données, puis tu réalises un projet complet d'analyse des ventes.",
        "category": "data-science", "level": "intermediate", "instructor": "mariam", "difficulty": 0.55, "hard_module": 1,
        "tags": ["Pandas", "Python", "Data", "Nettoyage", "DataFrame"],
        "outcomes": ["Charger des fichiers CSV et Excel", "Nettoyer les valeurs manquantes", "Filtrer et trier des données",
                     "Regrouper avec groupby", "Fusionner plusieurs tableaux", "Préparer des données pour un modèle"],
        "published_days_ago": 250,
        "modules": [
            ("Découvrir les DataFrames", [
                L("Séries et DataFrames", "Un DataFrame est un tableau avec des lignes et des colonnes nommées. Chaque colonne est une Série.", 12),
                L("Charger un fichier CSV", "`pd.read_csv('ventes.csv')` charge un fichier dans un DataFrame. On peut préciser le séparateur avec `sep=';'`.", 10),
                L("Explorer un jeu de données", "Premiers réflexes : `df.head()` pour les premières lignes, `df.shape` pour la taille, `df.info()` pour les types et les valeurs manquantes, `df.describe()` pour les statistiques.", 14),
            ], [
                Q("Quelle fonction charge un fichier CSV dans un DataFrame ?", ["pd.read_csv()", "pd.open_csv()", "pd.load()", "pd.DataFrame.csv()"], "Charger des données", 1),
                Q("Que renvoie df.shape ?", ["Le nombre de lignes et de colonnes", "Les noms des colonnes", "Les types des colonnes", "Les 5 premières lignes"], "Explorer un DataFrame", 2),
                Q("Quelle méthode affiche les premières lignes d'un DataFrame ?", ["df.head()", "df.top()", "df.first()", "df.show()"], "Explorer un DataFrame", 2),
            ]),
            ("Nettoyer les données", [
                L("Valeurs manquantes avec fillna", "Les valeurs manquantes (NaN) faussent les calculs. On peut les supprimer avec `dropna()` ou les remplacer avec `fillna()`, par exemple par la médiane de la colonne.", 16),
                L("Supprimer les doublons", "`df.duplicated()` repère les lignes en double et `df.drop_duplicates()` les supprime.", 11),
                L("Convertir les types", "Une colonne de prix lue comme du texte doit être convertie avec `astype(float)` ; une date avec `pd.to_datetime()`.", 13),
            ], [
                Q("Que fait df['age'].fillna(0) ?", ["Remplace les valeurs manquantes de la colonne age par 0", "Supprime les lignes où age vaut 0", "Remplace les 0 par des valeurs manquantes", "Compte les valeurs manquantes"], "Valeurs manquantes", 0, hint="fill = remplir, na = valeur manquante."),
                Q("Quelle méthode supprime les lignes en double ?", ["df.drop_duplicates()", "df.remove_duplicates()", "df.unique()", "df.dropna()"], "Doublons", 1),
                Q("À quoi sert cette ligne ?", ["Convertir la colonne prix en nombres décimaux", "Arrondir les prix", "Supprimer les prix manquants", "Trier la colonne prix"], "Types", 2, code="df['prix'] = df['prix'].astype(float)"),
            ]),
            ("Filtrer, trier, regrouper", [
                L("Filtrer et trier", "On filtre avec une condition entre crochets : `df[df['ville'] == 'Bobo']`. On trie avec `sort_values()`.", 12),
                L("Regrouper avec groupby", "`groupby` regroupe les lignes par catégorie pour calculer un total, une moyenne… par groupe.", 14),
                L("Fusionner avec merge", "`pd.merge(ventes, produits, on='produit_id')` combine deux tableaux grâce à une colonne commune.", 13),
            ], [
                Q("Comment garder les lignes où la colonne ville vaut 'Bobo' ?", ["df[df['ville'] == 'Bobo']", "df.where('Bobo')", "df['ville'].filter('Bobo')", "df.get('Bobo')"], "Filtrer", 0),
                Q("Que calcule ce code ?", ["Le total des ventes par ville", "Le nombre de villes", "La moyenne des ventes", "Les ventes triées par ville"], "groupby", 1, code="df.groupby('ville')['ventes'].sum()"),
                Q("Quelle fonction combine deux DataFrames à partir d'une colonne commune ?", ["pd.merge()", "pd.concat_on()", "pd.join_columns()", "pd.combine()"], "merge", 2),
            ]),
            ("Projet : analyser des ventes", [
                L("Préparer les données de ventes", "Tu appliques toute la méthode sur un vrai fichier de ventes : chargement, nettoyage, conversion des dates.", 18),
                L("Construire un rapport", "Tu calcules les indicateurs clés (chiffre d'affaires par mois, par produit, par ville) et tu rédiges tes conclusions.", 20),
            ], [
                Q("Avant d'analyser des ventes, quelle est la première étape ?", ["Vérifier et nettoyer les données", "Faire un graphique", "Entraîner un modèle", "Supprimer les colonnes texte"], "Méthode", 0),
                Q("Quel indicateur répond à « quel produit rapporte le plus ? »", ["La somme du chiffre d'affaires par produit", "Le nombre de colonnes", "La médiane des dates", "L'écart-type des identifiants"], "Analyse", 1),
            ]),
        ],
    },
    # -------------------------------------------------------------------- Viz
    {
        "key": "viz",
        "title": "Visualisation avec Matplotlib",
        "subtitle": "Des graphiques clairs qui racontent quelque chose.",
        "description": "Un bon graphique vaut mieux qu'un long discours. Tu apprends à créer des courbes, barres, "
        "histogrammes et nuages de points avec Matplotlib, à choisir le bon graphique pour chaque question et à "
        "éviter les erreurs qui rendent un graphique trompeur.",
        "category": "data-science", "level": "beginner", "instructor": "mariam", "difficulty": 0.3,
        "tags": ["Visualisation", "Graphiques", "Python", "Data"],
        "outcomes": ["Créer les graphiques essentiels", "Choisir le bon graphique", "Éviter les graphiques trompeurs"],
        "published_days_ago": 220,
        "modules": [
            ("Premiers graphiques", [L("Courbes et barres", "", 10), L("Personnaliser un graphique", "", 9)], [
                Q("Quel graphique pour montrer une évolution dans le temps ?", ["Une courbe", "Un camembert", "Un nuage de points", "Une boîte à moustaches"], "Courbes", 0),
                Q("Que fait cette ligne ?", ["Elle ajoute un titre au graphique", "Elle enregistre le graphique", "Elle crée une figure vide", "Elle change la couleur des barres"], "Personnaliser", 1, code="plt.title('Ventes 2026')"),
            ]),
            ("Choisir le bon graphique", [L("Histogrammes et boîtes", "", 11), L("Nuages de points", "", 9), L("Erreurs fréquentes", "", 8, video=False)], [
                Q("Pour voir la répartition des âges, on utilise…", ["un histogramme", "une courbe", "un camembert", "une carte"], "Histogrammes", 0),
                Q("Quel graphique pour étudier le lien entre deux variables numériques ?", ["Un nuage de points", "Un histogramme", "Un diagramme circulaire", "Un tableau"], "Nuages de points", 1),
                Q("Quelle erreur rend un graphique en barres trompeur ?", ["Un axe vertical qui ne commence pas à zéro", "Un titre clair", "Des étiquettes lisibles", "Une légende"], "Erreurs fréquentes", 2),
            ]),
            ("Raconter avec les données", [L("Composer un tableau de bord", "", 12), L("Exporter et partager", "", 7)], [
                Q("Quelle fonction enregistre un graphique dans un fichier ?", ["plt.savefig()", "plt.save()", "plt.export()", "plt.write()"], "Exporter", 1),
                Q("Combien de messages clés vise-t-on par graphique ?", ["Un seul", "Le plus possible", "Au moins cinq", "Aucun"], "Raconter", 0),
            ]),
        ],
    },
    # -------------------------------------------------------------------- ML
    {
        "key": "ml",
        "title": "Machine Learning avec scikit-learn",
        "subtitle": "Entraîner, évaluer et améliorer tes premiers modèles.",
        "description": "Découvre les principaux algorithmes de machine learning et apprends à les entraîner et à les évaluer "
        "avec scikit-learn, sur des données réelles : régression, classification, métriques, validation croisée et "
        "lutte contre le sur-apprentissage.",
        "category": "intelligence-artificielle", "level": "intermediate", "instructor": "issa", "difficulty": 0.65, "hard_module": 2,
        "tags": ["Machine learning", "scikit-learn", "Python", "Modèles", "Data"],
        "outcomes": ["Distinguer régression et classification", "Entraîner un modèle avec scikit-learn",
                     "Lire une matrice de confusion", "Éviter le sur-apprentissage"],
        "published_days_ago": 190,
        "modules": [
            ("Comprendre le machine learning", [L("Apprentissage supervisé et non supervisé", "", 12), L("Préparer les données", "", 14)], [
                Q("Prédire le prix d'une maison à partir de sa surface est un problème…", ["de régression supervisée", "de classification non supervisée", "de clustering", "de réduction de dimension"], "Types d'apprentissage", 0),
                Q("Pourquoi sépare-t-on les données en ensembles d'entraînement et de test ?", ["Pour évaluer le modèle sur des données qu'il n'a jamais vues", "Pour aller plus vite", "Pour avoir moins de colonnes", "Parce que scikit-learn l'impose"], "Préparer les données", 1),
            ]),
            ("Régression", [L("La régression linéaire", "", 15), L("Évaluer une régression", "", 12)], [
                Q("Quelle métrique mesure l'erreur moyenne d'une régression ?", ["La MAE (erreur absolue moyenne)", "L'accuracy", "Le rappel", "L'AUC"], "Évaluer une régression", 1),
                Q("Que fait la dernière ligne ?", ["Elle entraîne le modèle", "Elle prédit des valeurs", "Elle évalue le modèle", "Elle charge les données"], "Régression linéaire", 0, code="from sklearn.linear_model import LinearRegression\nmodel = LinearRegression()\nmodel.fit(X_train, y_train)"),
            ]),
            ("Classification", [L("La régression logistique", "", 14), L("Les arbres de décision", "", 13), L("Matrice de confusion et métriques", "", 15)], [
                Q("Dans une matrice de confusion, un faux négatif est…", ["un cas positif prédit négatif", "un cas négatif prédit positif", "un cas positif bien prédit", "une erreur de saisie"], "Matrice de confusion", 2),
                Q("Pour détecter le plus possible d'apprenants qui vont abandonner, on cherche à maximiser…", ["le rappel", "la précision", "le nombre de colonnes", "la vitesse d'entraînement"], "Métriques", 2),
                Q("Quel modèle est facile à expliquer car chaque variable a un coefficient ?", ["La régression logistique", "Un réseau de neurones profond", "Une forêt de 500 arbres", "Le k-means"], "Régression logistique", 0),
            ]),
            ("Valider un modèle", [L("Validation croisée", "", 12), L("Sur-apprentissage et régularisation", "", 14)], [
                Q("Un modèle excellent sur l'entraînement mais mauvais sur le test souffre de…", ["sur-apprentissage", "sous-apprentissage", "fuite de mémoire", "normalisation"], "Sur-apprentissage", 1),
                Q("À quoi sert la validation croisée ?", ["À estimer la performance de façon plus fiable", "À entraîner plus vite", "À supprimer les données manquantes", "À choisir les couleurs des graphiques"], "Validation croisée", 0),
            ]),
        ],
    },
    # -------------------------------------------------------------------- SQL
    {
        "key": "sql",
        "title": "SQL pour l'analyse",
        "subtitle": "Interroger une base de données pour répondre à des questions concrètes.",
        "description": "Le SQL est le langage des bases de données. En 4 heures, tu apprends à sélectionner, filtrer, "
        "trier et agréger des données, puis à combiner plusieurs tables avec les jointures. Un cours court et très "
        "pratique, idéal pour reprendre confiance.",
        "category": "bases-de-donnees", "level": "beginner", "instructor": "abdoul", "difficulty": 0.3,
        "tags": ["SQL", "Bases de données", "Requêtes", "Data"],
        "outcomes": ["Écrire des requêtes SELECT", "Agréger avec GROUP BY", "Combiner des tables avec les jointures"],
        "published_days_ago": 240,
        "modules": [
            ("Premières requêtes", [L("SELECT et FROM", "", 9), L("Filtrer avec WHERE", "", 8), L("Trier avec ORDER BY", "", 7)], [
                Q("Quelle requête renvoie toutes les colonnes de la table clients ?", ["SELECT * FROM clients;", "GET ALL clients;", "SELECT clients;", "SHOW * clients;"], "SELECT", 0),
                Q("Quel mot-clé filtre les lignes ?", ["WHERE", "FILTER", "HAVING", "ORDER BY"], "WHERE", 1),
                Q("Comment trier du plus grand au plus petit ?", ["ORDER BY montant DESC", "ORDER BY montant ASC", "SORT montant DOWN", "GROUP BY montant"], "ORDER BY", 2),
            ]),
            ("Agréger les données", [L("COUNT, SUM et AVG", "", 10), L("GROUP BY et HAVING", "", 11)], [
                Q("Quelle fonction compte le nombre de lignes ?", ["COUNT(*)", "SUM(*)", "TOTAL()", "NUMBER()"], "Agrégats", 0),
                Q("Quelle clause filtre le résultat d'un GROUP BY ?", ["HAVING", "WHERE", "FILTER BY", "LIMIT"], "HAVING", 1),
            ]),
            ("Les jointures", [L("INNER JOIN", "", 11), L("LEFT JOIN", "", 10), L("Requêtes imbriquées", "", 12, video=False)], [
                Q("Un INNER JOIN renvoie…", ["seulement les lignes qui ont une correspondance dans les deux tables", "toutes les lignes de la table de gauche", "toutes les lignes des deux tables", "aucune ligne en double"], "INNER JOIN", 0),
                Q("Pour garder tous les clients, même ceux sans commande, on utilise…", ["LEFT JOIN", "INNER JOIN", "CROSS JOIN", "UNION"], "LEFT JOIN", 1),
            ]),
        ],
    },
    # ------------------------------------------------------------ Autres cours
    {"key": "bdd", "title": "Concevoir une base de données", "subtitle": "Modéliser des données solides avec PostgreSQL.",
     "category": "bases-de-donnees", "level": "intermediate", "instructor": "abdoul", "difficulty": 0.5,
     "tags": ["Bases de données", "Modélisation", "PostgreSQL", "SQL"], "published_days_ago": 160,
     "modules": [("Modéliser", ["Entités et relations", "Le modèle relationnel"]), ("La normalisation", ["Les formes normales", "Clés primaires et étrangères"]), ("PostgreSQL en pratique", ["Créer des tables", "Index et performances"])]},
    {"key": "excel", "title": "Excel pour l'analyse de données", "subtitle": "Formules, tableaux croisés et graphiques pour analyser vite.",
     "category": "bureautique", "level": "beginner", "instructor": "clarisse", "difficulty": 0.25,
     "tags": ["Excel", "Bureautique", "Data", "Tableaux de bord"], "published_days_ago": 270,
     "modules": [("Les formules essentielles", ["Références et formules", "SI, SOMME.SI et RECHERCHEV"]), ("Tableaux croisés dynamiques", ["Créer un tableau croisé", "Filtres et segments"]), ("Graphiques et mise en forme", ["Graphiques adaptés", "Mise en forme conditionnelle"])]},
    {"key": "powerbi", "title": "Power BI : créer des tableaux de bord", "subtitle": "Des tableaux de bord interactifs pour piloter l'activité.",
     "category": "data-science", "level": "intermediate", "instructor": "clarisse", "difficulty": 0.45,
     "tags": ["Power BI", "Tableaux de bord", "Visualisation", "Data"], "published_days_ago": 25,
     "modules": [("Importer et préparer", ["Se connecter aux sources", "Power Query"]), ("Modéliser", ["Relations entre tables", "Mesures DAX"]), ("Publier", ["Concevoir un tableau de bord", "Partager un rapport"])]},
    {"key": "poo", "title": "Python : les bases de la POO", "subtitle": "Classes, objets et héritage pour mieux organiser ton code.",
     "category": "programmation", "level": "intermediate", "instructor": "boukary", "difficulty": 0.5,
     "tags": ["Python", "POO", "Classes", "Programmation"], "published_days_ago": 200,
     "modules": [("Classes et objets", ["Créer une classe", "Attributs et méthodes"]), ("Héritage", ["Hériter d'une classe", "Redéfinir une méthode"]), ("Bonnes pratiques", ["Encapsulation", "Organiser un projet"])]},
    {"key": "automatiser", "title": "Automatiser avec Python", "subtitle": "Gagner des heures en automatisant les tâches répétitives.",
     "category": "programmation", "level": "beginner", "instructor": "boukary", "difficulty": 0.3,
     "tags": ["Python", "Automatisation", "Scripts", "Excel"], "published_days_ago": 150,
     "modules": [("Fichiers et dossiers", ["Lire et écrire des fichiers", "Renommer des fichiers en masse"]), ("Automatiser Excel", ["Lire un classeur", "Générer un rapport"]), ("Planifier", ["Lancer un script automatiquement"])]},
    {"key": "git", "title": "Git et GitHub pour débuter", "subtitle": "Sauvegarder, partager et collaborer sur ton code.",
     "category": "programmation", "level": "beginner", "instructor": "boukary", "difficulty": 0.3,
     "tags": ["Git", "GitHub", "Versionnement", "Programmation"], "published_days_ago": 230,
     "modules": [("Les bases de Git", ["Pourquoi versionner son code", "Commits et historique"]), ("Branches", ["Créer une branche", "Fusionner et résoudre un conflit"]), ("GitHub", ["Publier sur GitHub", "Pull requests"])]},
    {"key": "js", "title": "JavaScript : les fondamentaux", "subtitle": "Le langage du web, des variables au DOM.",
     "category": "programmation", "level": "beginner", "instructor": "boukary", "difficulty": 0.4,
     "tags": ["JavaScript", "Web", "Programmation"], "published_days_ago": 175,
     "modules": [("Syntaxe", ["Variables et types", "Fonctions et fonctions fléchées"]), ("Le DOM", ["Sélectionner des éléments", "Réagir aux événements"]), ("Asynchrone", ["Les promesses", "Appeler une API avec fetch"])]},
    {"key": "api_django", "title": "Créer une API avec Django", "subtitle": "Une API REST professionnelle avec Django REST Framework.",
     "category": "programmation", "level": "advanced", "instructor": "boukary", "difficulty": 0.7,
     "tags": ["Django", "Python", "API", "Web"], "published_days_ago": 40,
     "modules": [("Django en bref", ["Projet et applications", "Modèles et migrations"]), ("Django REST Framework", ["Sérialiseurs", "Vues et routes"]), ("Sécuriser l'API", ["Authentification JWT", "Permissions"])]},
    {"key": "intro_ia", "title": "Introduction à l'intelligence artificielle", "subtitle": "Comprendre ce que l'IA sait faire… et ce qu'elle ne sait pas faire.",
     "category": "intelligence-artificielle", "level": "beginner", "instructor": "issa", "difficulty": 0.25,
     "tags": ["IA", "Machine learning", "Éthique"], "published_days_ago": 260,
     "modules": [("Qu'est-ce que l'IA ?", ["Une brève histoire de l'IA", "IA, machine learning et deep learning"]), ("L'IA au quotidien", ["Recommandations et assistants", "Vision et langage"]), ("Enjeux", ["Biais et éthique", "Utiliser l'IA de façon responsable"])]},
    {"key": "nlp", "title": "Traitement du langage naturel", "subtitle": "Faire comprendre des textes à une machine.",
     "category": "intelligence-artificielle", "level": "advanced", "instructor": "issa", "difficulty": 0.75,
     "tags": ["NLP", "Texte", "IA", "Python", "Embeddings"], "published_days_ago": 18,
     "modules": [("Préparer du texte", ["Nettoyer et découper un texte", "TF-IDF"]), ("Représenter le sens", ["Les embeddings de mots", "Similarité entre documents"]), ("Applications", ["Classer des avis clients", "Moteur de recherche sémantique"])]},
    {"key": "agile", "title": "Gestion de projet agile", "subtitle": "Scrum et Kanban pour livrer plus souvent, avec moins de stress.",
     "category": "gestion-de-projet", "level": "beginner", "instructor": "fatimata", "difficulty": 0.25,
     "tags": ["Agile", "Scrum", "Gestion de projet", "Équipe"], "published_days_ago": 210,
     "modules": [("L'esprit agile", ["Les valeurs agiles", "Agile ou cycle en V ?"]), ("Scrum", ["Rôles et cérémonies", "Le backlog"]), ("Kanban", ["Visualiser le travail", "Limiter le travail en cours"])]},
    {"key": "planifier", "title": "Planifier et suivre un projet", "subtitle": "Planning, budget et risques sous contrôle.",
     "category": "gestion-de-projet", "level": "intermediate", "instructor": "fatimata", "difficulty": 0.4,
     "tags": ["Planning", "Gestion de projet", "Risques"], "published_days_ago": 140,
     "modules": [("Cadrer", ["Objectifs et périmètre", "Les parties prenantes"]), ("Planifier", ["Découper en tâches", "Le diagramme de Gantt"]), ("Piloter", ["Suivre l'avancement", "Gérer les risques"])]},
    {"key": "prise_parole", "title": "Prise de parole en public", "subtitle": "Présenter avec clarté et assurance.",
     "category": "communication", "level": "beginner", "instructor": "fatimata", "difficulty": 0.2,
     "tags": ["Communication", "Oral", "Présentation"], "published_days_ago": 120,
     "modules": [("Préparer", ["Construire son message", "Connaître son public"]), ("Présenter", ["La voix et le regard", "Gérer le stress"]), ("Interagir", ["Répondre aux questions"])]},
    {"key": "emails", "title": "Écrire des e-mails professionnels", "subtitle": "Des messages courts, clairs et efficaces.",
     "category": "communication", "level": "beginner", "instructor": "fatimata", "difficulty": 0.15,
     "tags": ["Communication", "Écrit", "E-mail"], "published_days_ago": 100,
     "modules": [("Les bases", ["Objet et structure", "Le bon ton"]), ("Situations délicates", ["Relancer sans froisser", "Annoncer une mauvaise nouvelle"])]},
    {"key": "lancer", "title": "Lancer son entreprise", "subtitle": "De l'idée au premier client.",
     "category": "entrepreneuriat", "level": "beginner", "instructor": "clarisse", "difficulty": 0.3,
     "tags": ["Entrepreneuriat", "Business plan", "Marketing"], "published_days_ago": 180,
     "modules": [("Valider son idée", ["Étudier son marché", "Tester son offre"]), ("Le business plan", ["Construire son modèle économique", "Prévisions financières"]), ("Démarrer", ["Statut juridique", "Trouver ses premiers clients"])]},
    {"key": "marketing", "title": "Marketing digital", "subtitle": "Se faire connaître sur internet et les réseaux sociaux.",
     "category": "entrepreneuriat", "level": "intermediate", "instructor": "clarisse", "difficulty": 0.35,
     "tags": ["Marketing", "Réseaux sociaux", "Digital", "Communication"], "published_days_ago": 60,
     "modules": [("Stratégie", ["Définir sa cible", "Choisir ses canaux"]), ("Réseaux sociaux", ["Créer du contenu", "Mesurer ses résultats"]), ("Publicité en ligne", ["Lancer une campagne", "Optimiser son budget"])]},
    {"key": "word_ppt", "title": "Word et PowerPoint efficaces", "subtitle": "Des documents et présentations professionnels en moins de temps.",
     "category": "bureautique", "level": "beginner", "instructor": "clarisse", "difficulty": 0.15,
     "tags": ["Word", "PowerPoint", "Bureautique", "Présentation"], "published_days_ago": 130,
     "modules": [("Word", ["Styles et table des matières", "Modèles de documents"]), ("PowerPoint", ["Des diapositives lisibles", "Animations utiles"])]},
    # --- Cours non publiés (validation, brouillon) --------------------------------
    {"key": "deep", "title": "Deep learning : premiers pas", "subtitle": "Les réseaux de neurones expliqués simplement.",
     "category": "intelligence-artificielle", "level": "advanced", "instructor": "issa", "difficulty": 0.8,
     "tags": ["Deep learning", "Réseaux de neurones", "IA", "Python"], "status": "pending", "submitted_days_ago": 3, "missing_quiz_module": 3,
     "modules": [("Le neurone artificiel", ["Du neurone biologique au perceptron", "Fonctions d'activation"]), ("Entraîner un réseau", ["La descente de gradient", "La rétropropagation"]), ("Réseaux convolutifs", ["Reconnaître des images"])]},
    {"key": "communiquer", "title": "Communiquer avec les données", "subtitle": "Transformer une analyse en message convaincant.",
     "category": "communication", "level": "beginner", "instructor": "mariam", "difficulty": 0.25,
     "tags": ["Communication", "Storytelling", "Visualisation", "Data"], "status": "pending", "submitted_days_ago": 0,
     "modules": [("Le message", ["Trouver le message clé", "Adapter au public"]), ("La forme", ["Le bon graphique", "Une présentation qui convainc"])]},
    {"key": "projet_final", "title": "Projet final : tableau de bord", "subtitle": "Un projet complet de bout en bout pour ton portfolio.",
     "category": "data-science", "level": "intermediate", "instructor": "mariam", "difficulty": 0.6,
     "tags": ["Data", "Tableaux de bord", "Python", "Pandas"], "status": "draft",
     "modules": [("Le cahier des charges", ["Comprendre le besoin"])]},
]

GOAL_PATHS = {
    "data_analyst": ["python", "stats", "pandas", "sql", "viz", "excel", "powerbi", "ml", "bdd"],
    "developer": ["python", "git", "poo", "automatiser", "js", "sql", "api_django", "bdd"],
    "ai": ["intro_ia", "python", "stats", "pandas", "ml", "nlp"],
    "career": ["excel", "agile", "emails", "planifier", "word_ppt", "prise_parole", "lancer", "marketing"],
}

GOAL_INTERESTS = {
    "data_analyst": ["Python", "Statistiques", "Pandas", "SQL", "Visualisation", "Excel", "Tableaux de bord", "Data"],
    "developer": ["Python", "Programmation", "Git", "JavaScript", "POO", "Django", "API", "SQL"],
    "ai": ["IA", "Machine learning", "Python", "NLP", "Statistiques", "Data", "Embeddings"],
    "career": ["Gestion de projet", "Agile", "Communication", "Excel", "Bureautique", "Entrepreneuriat", "Marketing", "Oral"],
}

FIRST_NAMES = [
    "Aminata", "Awa", "Fatou", "Mariam", "Salimata", "Rasmata", "Aïcha", "Habibou", "Kadiatou", "Djeneba", "Assita",
    "Rokia", "Safiatou", "Nafissatou", "Bintou", "Clarisse", "Pélagie", "Sandrine", "Estelle", "Yasmine", "Ramatou",
    "Moussa", "Ibrahim", "Salif", "Ousmane", "Issouf", "Adama", "Boukary", "Seydou", "Abdoulaye", "Karim", "Hamidou",
    "Souleymane", "Idrissa", "Arouna", "Lassina", "Yacouba", "Drissa", "Jean", "Paul", "Wendpouiré", "Rodrigue",
    "Serge", "Hervé", "Patrice", "Ismaël", "Bakary", "Mahamadi", "Tiémoko", "Zakaria",
]
LAST_NAMES = [
    "Ouédraogo", "Sawadogo", "Traoré", "Kaboré", "Compaoré", "Zongo", "Ouattara", "Diallo", "Sanou", "Coulibaly",
    "Kiemtoré", "Nikiéma", "Bationo", "Konaté", "Sangaré", "Barry", "Tapsoba", "Yaméogo", "Ilboudo", "Somé", "Kafando",
    "Dao", "Sankara", "Bamogo", "Zoungrana", "Kinda", "Belem", "Tiendrébéogo", "Guiro", "Diarra",
]

REVIEW_COMMENTS = {
    5: ["Excellent cours, très clair et bien rythmé.", "Les exemples concrets m'ont beaucoup aidé.", "Parfait pour débuter, je recommande !",
        "Le formateur explique très bien, les quiz sont utiles."],
    4: ["Très bon cours, quelques exercices en plus seraient un plus.", "Bien expliqué, j'ai appris beaucoup de choses.",
        "Bon contenu, le dernier module est un peu rapide."],
    3: ["Correct, mais certaines leçons vont trop vite.", "Intéressant mais il manque des exercices pratiques."],
    2: ["Trop difficile pour moi, il manque des explications.", "Le module 2 est compliqué à suivre."],
    1: ["Je n'ai pas réussi à suivre."],
}
