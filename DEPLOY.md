# 🚀 Guide de Déploiement Production - Dwaya Backend

## 1. MongoDB Atlas (Base de données)

### Créer le cluster
1. Aller sur https://www.mongodb.com/atlas
2. Créer un compte / se connecter
3. Créer un nouveau projet "Dwaya"
4. Créer un cluster gratuit (M0 Sandbox)
5. Choisir la région : **Europe (Frankfurt)** pour la proximité avec le Maroc
6. Configurer l'accès réseau : **Allow access from anywhere** (0.0.0.0/0)
7. Créer un utilisateur database
8. Copier l'URI de connexion : `mongodb+srv://username:password@cluster.mongodb.net/dwaya`

---

## 2. Railway (Backend API)

### Déployer sur Railway
1. Aller sur https://railway.app
2. Se connecter avec GitHub
3. Créer un nouveau projet
4. Choisir "Deploy from GitHub repo"
5. Sélectionner le repo dwaya-backend
6. Ajouter les variables d'environnement (voir ci-dessous)
7. Déployer !

### Variables d'environnement Railway
```
NODE_ENV=production
PORT=5000
API_URL=https://votre-projet.railway.app
CLIENT_URL=https://votre-site-web.vercel.app

# MongoDB (remplacer avec votre URI Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dwaya?retryWrites=true&w=majority

# JWT (générer des clés fortes)
JWT_SECRET=votre_jwt_secret_tres_long_et_aleatoire_64_caracteres_min
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=votre_refresh_secret_different_64_caracteres_min
JWT_REFRESH_EXPIRE=30d

# Firebase (depuis votre compte)
FIREBASE_PROJECT_ID=votre-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@votre-project.iam.gserviceaccount.com

# Cloudinary (depuis votre compte)
CLOUDINARY_CLOUD_NAME=votre-cloud-name
CLOUDINARY_API_KEY=votre-api-key
CLOUDINARY_API_SECRET=votre-api-secret

# Stripe (mode PROD - attention!)
STRIPE_SECRET_KEY=sk_live_votre_cle_secrete
STRIPE_WEBHOOK_SECRET=whsec_votre_webhook_secret

# CMI (quand vous aurez le compte)
CMI_MERCHANT_ID=votre_merchant_id
CMI_API_KEY=votre_api_key_cmi
CMI_BASE_URL=https://payment.cmi.co.ma

# App Settings
DEFAULT_DELIVERY_FEE=20
FREE_DELIVERY_THRESHOLD=200
LOYALTY_POINTS_PER_DH=1
REFERRAL_BONUS_POINTS=100
```

---

## 3. Configurer Stripe (Production)

1. Aller sur https://dashboard.stripe.com
2. Activer le compte (completer les informations business)
3. Récupérer la clé secrète LIVE : `sk_live_...`
4. Créer un webhook endpoint : `https://votre-api.railway.app/api/payments/stripe/webhook`
5. Récupérer le webhook secret : `whsec_...`

---

## 4. Seed la base de données

Une fois Railway déployé, exécuter :
```bash
# Installer Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Se connecter
railway login

# Se lier au projet
railway link

# Exécuter le seed
railway run npm run seed
```

Ou via le dashboard Railway : "Run command" → `npm run seed`

---

## 5. Tester l'API

```bash
# Health check
curl https://votre-api.railway.app/api/health

# Login (avec les credentials seed)
curl -X POST https://votre-api.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"karim@example.com","password":"Password123!"}'
```

---

## 6. Connecter le Frontend Web

Modifier `/app/src/config/api.ts` :
```typescript
export const API_URL = 'https://votre-api.railway.app/api';
```

Puis redéployer le site web.

---

## 7. Connecter l'App Mobile

Modifier `dwaya-mobile/src/config/api.ts` :
```typescript
export const API_URL = 'https://votre-api.railway.app/api';
export const SOCKET_URL = 'https://votre-api.railway.app';
```

Puis builder avec Expo EAS.

---

## ✅ Checklist Pré-Lancement

- [ ] MongoDB Atlas cluster créé
- [ ] Railway API déployée et fonctionnelle
- [ ] Firebase configuré (serviceAccountKey)
- [ ] Cloudinary configuré
- [ ] Stripe en mode LIVE configuré
- [ ] Variables d'environnement toutes remplies
- [ ] Base de données seedée
- [ ] Frontend web connecté à l'API
- [ ] App mobile connectée à l'API
- [ ] Tests de connexion réussis
- [ ] Paiement testé (montant minime)

---

## 🆘 Support

En cas de problème :
1. Vérifier les logs Railway (Dashboard → Deployments → Logs)
2. Vérifier que toutes les variables d'environnement sont définies
3. Tester l'API avec Postman/Insomnia
4. Vérifier les autorisations MongoDB Atlas
