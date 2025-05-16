# devis_housinnovation


### 1. Préparation de l'environnement

```bash
# Mise à jour du système
 apt update &&  apt upgrade -y

# Installation des dépendances
 apt install -y nodejs npm mongodb-org git

# Vérification des versions
node -v  # Doit être v16+
npm -v
mongod --version
```

### 2. Configuration de MongoDB

```bash
# Démarrer le service
 systemctl start mongod
 systemctl enable mongod

# Créer un utilisateur admin
mongosh
use admin
db.createUser({
  user: "adminHous",
  pwd: "VotreMotDePasse123!",
  roles: ["root"]
})
exit

# Configurer l'authentification
 nano /etc/mongod.conf
```
Ajoutez/modifiez :
```yaml
security:
  authorization: enabled
```

```bash
 systemctl restart mongod
```

### 3. Installation de l'application

```bash
# Cloner le dépôt (remplacez par votre URL)
git clone https://github.com/votre-repo/devis_housinnovation.git
cd devis_housinnovation

# Installation des dépendances
npm install

# Configuration de l'environnement
cp .env.example .env
nano .env
```
Remplissez le fichier `.env` :
```env
DB_URI=mongodb://adminHous:VotreMotDePasse123!@localhost:27017/devis_housinnovation?authSource=admin
PORT=3000
SESSION_SECRET=votre_secret_session
```

### 4. Initialisation de la base de données

```bash
# Créer les utilisateurs initiaux
node initUsers.js
```

### 5. Lancement de l'application

```bash
# En mode développement
npm run dev

# Ou en production avec PM2
 npm install -g pm2
pm2 start app.js --name "devis-housinnovation"
pm2 save
pm2 startup
```

### 6. Accès à l'application

Ouvrez votre navigateur à :
```
http://votre-ip:3000
```

### 7. Configuration du reverse proxy (optionnel)

Pour utiliser un nom de domaine et HTTPS :

```bash
 apt install -y nginx
 nano /etc/nginx/sites-available/devis-housinnovation
```

Configuration Nginx :
```nginx
server {
    listen 80;
    server_name devis.housinnovation.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activez le site :
```bash
 ln -s /etc/nginx/sites-available/devis-housinnovation /etc/nginx/sites-enabled
 nginx -t
 systemctl restart nginx
```

### 8. Sécurisation avec Let's Encrypt

```bash
 apt install -y certbot python3-certbot-nginx
 certbot --nginx -d devis.housinnovation.com
```

### Si vous rencontrez toujours des problèmes :

1. Vérifiez les logs :
```bash
journalctl -u mongod -f
pm2 logs
```

2. Vérifiez les ports ouverts :
```bash
 ufw allow 3000
 ufw allow 80
 ufw allow 443
```

Cette procédure complète partant de zéro devrait résoudre tous les problèmes précédents. L'application sera accessible avec :
- Interface web sur le port 3000
- Base de données MongoDB sécurisée
- Option HTTPS via Nginx
