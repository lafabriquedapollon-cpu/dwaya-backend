# 🏥 Dwaya Backend API

Backend API pour Dwaya, la plateforme de livraison de médicaments au Maroc.

## 🚀 Technologies

- **Node.js** + **Express** - Framework web
- **MongoDB** + **Mongoose** - Base de données
- **Socket.io** - Temps réel (chat, tracking)
- **JWT** - Authentification
- **Stripe** + **CMI** - Paiement
- **Firebase** - Push notifications
- **Cloudinary** - Stockage d'images

## 📁 Structure du Projet

```
dwaya-backend/
├── src/
│   ├── config/           # Configuration (DB, Firebase, Cloudinary)
│   ├── controllers/      # Contrôleurs API
│   ├── middleware/       # Middleware (auth, validation, errors)
│   ├── models/           # Modèles Mongoose
│   ├── routes/           # Routes API
│   ├── sockets/          # Socket.io handlers
│   ├── utils/            # Utilitaires
│   └── server.js         # Point d'entrée
├── uploads/              # Fichiers uploadés
├── tests/                # Tests
└── package.json
```

## 🛠️ Installation

```bash
# Cloner le repository
git clone <repo-url>
cd dwaya-backend

# Installer les dépendances
npm install

# Configuration
cp .env.example .env
# Éditer .env avec vos credentials

# Démarrer MongoDB localement ou utiliser MongoDB Atlas

# Seed la base de données
npm run seed

# Démarrer le serveur en développement
npm run dev

# Démarrer en production
npm start
```

## 🔌 API Endpoints

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Profil utilisateur |
| PUT | `/api/auth/profile` | Modifier profil |
| PUT | `/api/auth/password` | Changer mot de passe |
| POST | `/api/auth/refresh` | Rafraîchir token |

### Pharmacies
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/pharmacies` | Liste des pharmacies |
| GET | `/api/pharmacies/guard` | Pharmacies de garde |
| GET | `/api/pharmacies/:id` | Détails pharmacie |
| GET | `/api/pharmacies/:id/medications` | Médicaments |
| POST | `/api/pharmacies` | Créer pharmacie |
| POST | `/api/pharmacies/:id/reviews` | Ajouter avis |

### Commandes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/orders` | Créer commande |
| GET | `/api/orders` | Mes commandes |
| GET | `/api/orders/:id` | Détails commande |
| PUT | `/api/orders/:id/status` | Mettre à jour statut |
| PUT | `/api/orders/:id/cancel` | Annuler commande |
| POST | `/api/orders/:id/review` | Évaluer commande |

### Chat
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/chat/rooms` | Mes conversations |
| POST | `/api/chat/rooms` | Créer conversation |
| GET | `/api/chat/rooms/:id/messages` | Messages |
| POST | `/api/chat/rooms/:id/messages` | Envoyer message |

### Paiement
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/payments/stripe/create-intent` | Paiement Stripe |
| POST | `/api/payments/cmi/create` | Paiement CMI |
| POST | `/api/payments/cod/confirm` | Paiement à la livraison |

## 🔐 Variables d'Environnement

```env
# Server
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/dwaya

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CMI (Paiement Maroc)
CMI_MERCHANT_ID=your_merchant_id
CMI_API_KEY=your_api_key

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 📡 Socket.io Events

### Chat Namespace (`/chat`)
```javascript
// Rejoindre une room
socket.emit('join_room', roomId);

// Envoyer un message
socket.emit('send_message', {
  roomId,
  content: 'Hello!',
  type: 'text'
});

// Recevoir un message
socket.on('new_message', (data) => {
  console.log(data.message);
});
```

### Driver Namespace (`/driver`)
```javascript
// Mettre à jour la position
socket.emit('update_location', {
  latitude: 33.5731,
  longitude: -7.5898,
  orderId: 'order_id'
});

// Suivre une commande (côté client)
socket.emit('track_order', orderId);
socket.on('location_update', (data) => {
  console.log(data.location);
});
```

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Tests avec couverture
npm run test:coverage
```

## 📝 Licence

MIT License - Dwaya Team
