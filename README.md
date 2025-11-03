# ABCDent Checker - Cloud Function

Cette Cloud Function vérifie automatiquement la présence d'une annonce spécifique sur ABCDent.pro et envoie le résultat à un webhook n8n.

## 🎯 Fonctionnalités

- ✅ Connexion automatique sur ABCDent.pro
- ✅ Navigation vers la page des annonces publiées
- ✅ Détection de l'annonce "Recrutement chirurgien dentiste 75 77 91 92 94 h/f"
- ✅ Envoi du résultat (OK/KO) au webhook n8n
- ✅ Gestion des erreurs robuste
- ✅ Compatible avec Google Cloud Functions

## 📋 Prérequis

- Node.js 18 ou supérieur
- Compte Google Cloud avec les Cloud Functions activées
- Credentials ABCDent valides
- gcloud CLI installé et configuré

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone <repository-url>
cd cloud-function-abcdent
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration

Créez un fichier `.env` à partir de l'exemple :

```bash
cp .env.example .env
```

Éditez le fichier `.env` et ajoutez vos credentials :

```env
ABCDENT_USERNAME=votre_email@example.com
ABCDENT_PASSWORD=votre_mot_de_passe
```

## 🧪 Test en local

### Méthode 1 : Test direct

```bash
node index.js
```

### Méthode 2 : Avec Functions Framework

```bash
npm run dev
```

Puis testez avec curl :

```bash
curl http://localhost:8080
```

## 📦 Déploiement sur Google Cloud

### 1. Configuration initiale

```bash
# Se connecter à Google Cloud
gcloud auth login

# Sélectionner votre projet
gcloud config set project VOTRE_PROJECT_ID

# Activer les APIs nécessaires
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Déploiement de la fonction

```bash
# Définir les variables d'environnement
export ABCDENT_USERNAME="votre_email@example.com"
export ABCDENT_PASSWORD="votre_mot_de_passe"

# Déployer la fonction
gcloud functions deploy checkAbcdentAnnonce \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --memory 512MB \
  --timeout 60s \
  --region europe-west1 \
  --set-env-vars ABCDENT_USERNAME=$ABCDENT_USERNAME,ABCDENT_PASSWORD=$ABCDENT_PASSWORD \
  --entry-point checkAbcdentAnnonce
```

### 3. Configuration d'un Cloud Scheduler (optionnel)

Pour exécuter la fonction périodiquement :

```bash
# Créer une tâche planifiée (toutes les heures)
gcloud scheduler jobs create http check-abcdent-job \
  --location=europe-west1 \
  --schedule="0 * * * *" \
  --http-method=GET \
  --uri=https://europe-west1-VOTRE_PROJECT_ID.cloudfunctions.net/checkAbcdentAnnonce
```

## 🔧 Configuration avancée

### Ajustement des sélecteurs

Si la structure de la page ABCDent change, modifiez les sélecteurs dans `index.js` :

```javascript
const SELECTORS = {
  USERNAME_INPUT: 'input[name="email"]',  // Ajustez selon la page réelle
  PASSWORD_INPUT: 'input[name="password"]',
  LOGIN_BUTTON: 'button[type="submit"]',
  TARGET_ELEMENT: 'a[href="/annonces/352084-recrutement-chirurgien-dentiste-75-77-91-92-94-h-f"]'
};
```

### Timeout et performances

Modifiez les timeouts si nécessaire :

```javascript
// Dans index.js
await page.goto(url, { 
  waitUntil: 'networkidle2',
  timeout: 30000  // 30 secondes
});
```

## 📊 Structure de la réponse

### Succès

```json
{
  "success": true,
  "status": "OK",  // ou "KO"
  "webhook_sent": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Erreur

```json
{
  "success": false,
  "status": "KO",
  "webhook_sent": false,
  "webhook_error": "Message d'erreur",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🐛 Debugging

### Logs Google Cloud

```bash
# Voir les logs de la fonction
gcloud functions logs read checkAbcdentAnnonce --limit 50
```

### Mode développement

Pour plus de détails en développement local :

```bash
NODE_ENV=development CAPTURE_SCREENSHOT=true npm run dev
```

## ⚠️ Notes importantes

1. **Sécurité** : Ne jamais commiter le fichier `.env` avec les vrais credentials
2. **Limites** : Google Cloud Functions a une limite de timeout de 540 secondes max
3. **Coûts** : Surveillez l'utilisation pour éviter des coûts inattendus
4. **Rate limiting** : Respectez les limites du site ABCDent

## 🔄 Webhook n8n

Le webhook configuré est :
```
https://n8n.cemedis.app/webhook/d8fabe02-3a4f-4778-b2af-c291af88a731
```

Le webhook reçoit un JSON avec :
- `status` : "OK" si l'annonce est trouvée, "KO" sinon
- `timestamp` : Date/heure de la vérification
- `url_checked` : URL vérifiée
- `error` : Message d'erreur éventuel

## 📝 Licence

MIT - CEMEDIS 2024

## 🤝 Support

Pour toute question ou problème, contactez l'équipe technique CEMEDIS.
