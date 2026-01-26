# Fonctionnalité de Gestion du Stock

## Vue d'ensemble

Cette nouvelle fonctionnalité ajoute un système complet de gestion du stock des produits avec navigation entre les commandes en cours et la gestion des produits.

## Fonctionnalités Implémentées

### 1. Menu de Navigation dans la Toolbar

- **Page "Live"** : Affiche le tableau des commandes actuelles (page existante)
- **Page "Gérer le stock"** : Nouvelle page pour la gestion des produits
- Navigation via un menu accessible depuis l'icône de menu dans la toolbar

### 2. Page de Gestion du Stock

#### Fonctionnalités principales :

- **Liste complète des produits** : Affiche tous les produits (disponibles et indisponibles)
- **Toggle de disponibilité** : Bouton switch pour changer le statut `available`/`unavailable`
- **Mise à jour en temps réel** : Les changements sont immédiatement sauvegardés en base de données
- **Recherche avancée** : Filtrage par nom, catégorie ou description
- **Statistiques** : Affichage du nombre total, disponible et indisponible de produits

#### Interface utilisateur :

- **Grille responsive** : Adaptation automatique à différentes tailles d'écran
- **Cartes produit** : Affichage avec image, nom, prix, catégorie et description
- **Feedback visuel** :
  - Produits indisponibles affichés en grisé
  - Spinners de chargement pendant les mises à jour
  - Messages de confirmation/erreur via snackbars
- **État vide** : Messages informatifs quand aucun produit n'est trouvé

## Architecture Technique

### Nouveaux Composants

1. **StockManagerComponent** (`src/app/components/stock-manager/`)
   - Composant standalone avec tous les imports Material nécessaires
   - Gestion d'état avec RxJS et Angular Signals
   - Recherche avec debounce (300ms) pour optimiser les performances

### Services Étendus

2. **SupabaseService** - Nouvelles méthodes :
   - `getAllProducts()` : Récupère tous les produits (disponibles et indisponibles)
   - `updateProductAvailability(productId, isAvailable)` : Met à jour le statut d'un produit

### Types et Interfaces

3. **ProductWithCategory** : Interface étendue incluant :
   - Informations produit de base
   - Nom de catégorie résolu
   - État de disponibilité
   - Quantité en stock (optionnel)

### Routing

4. **Nouvelle route** : `/stock-manager`
   - Composant fullscreen sans layout
   - Accessible depuis le menu de navigation

## Améliorations UX/UI

### Design Patterns Utilisés

- **Optimistic Updates** : L'interface se met à jour immédiatement, puis gère les erreurs
- **Loading States** : États de chargement granulaires par produit
- **Error Handling** : Gestion d'erreurs avec rollback automatique
- **Accessibility** : Labels ARIA et navigation clavier

### Responsive Design

- **Desktop** : Grille multi-colonnes optimisée
- **Tablet** : Adaptation automatique de la grille
- **Mobile** : Une colonne avec interface tactile optimisée

## Base de Données

### Table `products` utilisée

- **Champ `is_available`** : Boolean pour la disponibilité
- **Mise à jour automatique** : `updated_at` timestamp lors des changements

## Navigation

### Menu de Navigation

- **Orders Manager** : `/orders-manager` - Gestion des commandes (existant)
- **Stock Manager** : `/stock-manager` - Gestion du stock (nouveau)

### Flux Utilisateur

1. L'utilisateur accède à `/orders-manager` (commandes)
2. Clic sur l'icône menu dans la toolbar
3. Sélection "Gérer le stock"
4. Navigation vers `/stock-manager`
5. Retour possible via le menu vers "Live - Commandes"

## Performance

### Optimisations Implémentées

- **TrackBy functions** : Optimisation des listes Angular
- **Debounced search** : Évite les requêtes excessives
- **Optimistic updates** : Interface réactive
- **Lazy loading** : Images chargées à la demande

## Installation et Utilisation

### Prérequis

- Base de données Supabase configurée
- Table `products` avec le champ `is_available`
- Authentification et permissions appropriées

### Accès

1. Naviguer vers `/orders-manager`
2. Cliquer sur l'icône menu (☰) dans la toolbar
3. Sélectionner "Gérer le stock"

### Utilisation

1. **Rechercher** : Utiliser le champ de recherche en haut
2. **Filtrer** : Les résultats se mettent à jour automatiquement
3. **Modifier disponibilité** : Utiliser le toggle à droite de chaque produit
4. **Statistiques** : Consulter les chips en haut à droite
5. **Navigation** : Retourner aux commandes via le menu

## Fichiers Modifiés/Ajoutés

### Nouveaux fichiers :

- `src/app/components/stock-manager/stock-manager.component.ts`
- `src/app/components/stock-manager/stock-manager.component.html`
- `src/app/components/stock-manager/stock-manager.component.scss`

### Fichiers modifiés :

- `src/app/app.routes.ts` - Ajout de la route `/stock-manager`
- `src/app/services/supabase.service.ts` - Nouvelles méthodes pour les produits
- `src/app/components/orders-manager/orders-manager.component.ts` - Ajout navigation
- `src/app/components/orders-manager/orders-manager.component.html` - Ajout menu toolbar
- `src/app/components/orders-manager/orders-manager.component.scss` - Styles du menu

## Tests Suggérés

1. **Navigation** : Vérifier les liens entre les deux pages
2. **Recherche** : Tester avec différents termes de recherche
3. **Toggle** : Vérifier les mises à jour en base de données
4. **Responsive** : Tester sur différentes tailles d'écran
5. **États d'erreur** : Vérifier la gestion des erreurs réseau
6. **Performance** : Tester avec un grand nombre de produits
