# 🚀 Guide de Démarrage Rapide - ABCDent Checker

## Installation en 5 minutes

### 1️⃣ Configuration initiale

```bash
# Cloner ou créer le répertoire
cd cloud-function-abcdent

# Installer les dépendances
npm install
```

### 2️⃣ Configuration des credentials

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env et ajouter vos credentials ABCDent
nano .env
# ou
code .env
```

Ajoutez dans `.env` :
```
ABCDENT_USERNAME=votre_email@example.com
ABCDENT_PASSWORD=votre_mot_de_passe
```

### 3️⃣ Test local

**Terminal 1 - Lancer la fonction :**
```bash
npm run dev
```

**Terminal 2 - Tester :**
```bash
node test-local.js
```

### 4️⃣ Déploiement Google Cloud

```bash
# Se connecter à Google Cloud
gcloud auth login

# Configurer votre projet
gcloud config set project VOTRE_PROJECT_ID

# Déployer avec le script automatisé
./deploy.sh
```

### 5️⃣ Planification automatique (optionnel)

Pour une exécution toutes les heures :

```bash
gcloud scheduler jobs create http check-abcdent \
  --location=europe-west1 \
  --schedule="0 * * * *" \
  --http-method=GET \
  --uri=https://europe-west1-VOTRE_PROJECT_ID.cloudfunctions.net/checkAbcdentAnnonce
```

## 📊 Monitoring

### Voir les logs
```bash
gcloud functions logs read checkAbcdentAnnonce --limit 10
```

### Tester manuellement
```bash
curl https://europe-west1-VOTRE_PROJECT_ID.cloudfunctions.net/checkAbcdentAnnonce
```

## 🔧 Personnalisation

### Changer l'annonce recherchée

Modifiez dans `index.js` :
```javascript
TARGET_ELEMENT: 'a[href="/annonces/VOTRE-ID-ANNONCE"]'
TARGET_TEXT: 'Votre titre d\'annonce'
```

### Utiliser la version améliorée

Pour une détection plus robuste, remplacez `index.js` par `index-enhanced.js` :
```bash
cp index-enhanced.js index.js
```

## ❓ Problèmes fréquents

### Erreur de connexion
- Vérifiez vos credentials dans `.env`
- Testez manuellement sur https://www.abcdent.pro/connexion

### Timeout
- Augmentez le timeout dans `deploy.sh` (max 540s pour Cloud Functions)

### Annonce non trouvée
- Vérifiez l'URL exacte de l'annonce
- Utilisez `index-enhanced.js` pour une détection plus flexible

## 📞 Support

Contact : Équipe technique CEMEDIS

---

**Temps estimé :** 5-10 minutes pour le déploiement complet
