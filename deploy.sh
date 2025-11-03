#!/bin/bash

# Script de déploiement pour ABCDent Checker Cloud Function
# Usage: ./deploy.sh

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FUNCTION_NAME="checkAbcdentAnnonce"
REGION="europe-west1"
RUNTIME="nodejs18"
MEMORY="512MB"
TIMEOUT="60s"

echo -e "${GREEN}🚀 Déploiement de la Cloud Function ABCDent Checker${NC}"
echo "================================================"

# Vérifier que gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI n'est pas installé${NC}"
    echo "Installez-le depuis : https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Charger les variables d'environnement depuis .env si le fichier existe
if [ -f .env ]; then
    echo -e "${YELLOW}📋 Chargement des variables depuis .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ Fichier .env non trouvé${NC}"
    echo "Créez-le à partir de .env.example"
    exit 1
fi

# Vérifier les credentials
if [ -z "$ABCDENT_USERNAME" ] || [ -z "$ABCDENT_PASSWORD" ]; then
    echo -e "${RED}❌ Les variables ABCDENT_USERNAME et ABCDENT_PASSWORD sont requises${NC}"
    exit 1
fi

# Afficher la configuration
echo -e "\n${YELLOW}📊 Configuration :${NC}"
echo "  • Nom de la fonction : $FUNCTION_NAME"
echo "  • Région : $REGION"
echo "  • Runtime : $RUNTIME"
echo "  • Mémoire : $MEMORY"
echo "  • Timeout : $TIMEOUT"
echo "  • Username : $ABCDENT_USERNAME"
echo "  • Password : ***"

# Demander confirmation
echo -e "\n${YELLOW}⚠️  Voulez-vous continuer le déploiement ? (y/N)${NC}"
read -r response
if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${RED}❌ Déploiement annulé${NC}"
    exit 0
fi

# Vérifier le projet Google Cloud actuel
echo -e "\n${YELLOW}🔍 Vérification du projet Google Cloud...${NC}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Aucun projet Google Cloud configuré${NC}"
    echo "Utilisez : gcloud config set project VOTRE_PROJECT_ID"
    exit 1
fi
echo -e "${GREEN}✅ Projet : $PROJECT_ID${NC}"

# Activer les APIs nécessaires
echo -e "\n${YELLOW}🔧 Activation des APIs Google Cloud...${NC}"
gcloud services enable cloudfunctions.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet
echo -e "${GREEN}✅ APIs activées${NC}"

# Installation des dépendances
echo -e "\n${YELLOW}📦 Installation des dépendances...${NC}"
npm install --production
echo -e "${GREEN}✅ Dépendances installées${NC}"

# Déploiement de la fonction
echo -e "\n${YELLOW}☁️  Déploiement de la Cloud Function...${NC}"
gcloud functions deploy $FUNCTION_NAME \
  --runtime=$RUNTIME \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --region=$REGION \
  --entry-point=$FUNCTION_NAME \
  --set-env-vars "ABCDENT_USERNAME=$ABCDENT_USERNAME,ABCDENT_PASSWORD=$ABCDENT_PASSWORD,NODE_ENV=production" \
  --quiet

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Déploiement réussi !${NC}"
    
    # Récupérer l'URL de la fonction
    FUNCTION_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/$FUNCTION_NAME"
    echo -e "\n${GREEN}📍 URL de la fonction :${NC}"
    echo "   $FUNCTION_URL"
    
    # Proposer de tester la fonction
    echo -e "\n${YELLOW}🧪 Voulez-vous tester la fonction maintenant ? (y/N)${NC}"
    read -r test_response
    if [[ "$test_response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "\n${YELLOW}⏳ Test en cours...${NC}"
        curl -s "$FUNCTION_URL" | python3 -m json.tool
        echo -e "\n${GREEN}✅ Test terminé${NC}"
    fi
    
    # Informations sur Cloud Scheduler
    echo -e "\n${YELLOW}📅 Pour planifier l'exécution périodique :${NC}"
    echo "gcloud scheduler jobs create http check-abcdent-job \\"
    echo "  --location=$REGION \\"
    echo "  --schedule=\"0 * * * *\" \\"
    echo "  --http-method=GET \\"
    echo "  --uri=$FUNCTION_URL"
    
    # Informations sur les logs
    echo -e "\n${YELLOW}📊 Pour voir les logs :${NC}"
    echo "gcloud functions logs read $FUNCTION_NAME --limit 50"
    
else
    echo -e "\n${RED}❌ Échec du déploiement${NC}"
    echo "Vérifiez les logs avec : gcloud functions logs read $FUNCTION_NAME"
    exit 1
fi

echo -e "\n${GREEN}🎉 Terminé !${NC}"
