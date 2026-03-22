# Documentation (FR)

Ce projet est un bot Discord pour le serveur "Site 35". Il gère les profils du personnel, les grades et les formations via des commandes slash.

## A quoi sert le bot ?

Le bot maintient une base de données des membres du serveur (nom, grade, unité et formations) et publie les changements dans des salons dédiés.

## Prérequis

- Un compte Discord
- Être administrateur (ou avoir les permissions) sur le serveur où vous voulez ajouter le bot

## Permissions nécessaires

Le bot a besoin des permissions suivantes pour fonctionner correctement :

- Manage Roles
- Manage Nicknames
- Send Messages
- Read Message History
- Add Reactions
- Use Slash Commands

## Inviter le bot sur votre serveur

1. Ouvrez ce lien dans votre navigateur :
   https://discord.com/oauth2/authorize?client_id=[CLIENT_ID]&permissions=5085097866947648&integration_type=0&scope=bot
2. Choisissez votre serveur dans la liste.
3. Vérifiez les permissions demandées.
4. Cliquez sur "Autoriser".

Si tout s'est bien passé, le bot apparaît dans la liste des membres du serveur.

## Commandes disponibles

Toutes les commandes sont des slash commands (tapez `/` dans Discord).

### `/profile`

Affiche la fiche d'un membre avec ses informations enregistrées.

- Option : `joueur` (facultatif). Si vous ne mettez rien, le bot affiche votre propre fiche.
- Réponse : message privé (visible seulement par vous) avec un embed "Dossier du personnel".

### `/add-training`

Ajoute une formation au profil d'un membre.

- Options :
    - `joueur` (obligatoire)
    - `formation` (obligatoire, liste avec auto-complétion)
- Effet :
    - Ajoute la formation dans la base de données.
    - Ajoute le rôle de la formation au membre.
    - Publie un message dans le salon des formations.
    - Réponse privée de confirmation.

### `/remove-training`

Retire une formation du profil d'un membre.

- Options :
    - `joueur` (obligatoire)
    - `formation` (obligatoire, liste avec auto-complétion)
- Effet :
    - Supprime la formation dans la base de données.
    - Réponse privée de confirmation.

### `/add-medal`

Ajoute une médaille au profil d'un membre.

- Options :
    - `joueur` (obligatoire)
    - `medaille` (obligatoire, liste avec auto-complétion)
    - `contexte` (obligatoire)
- Effet :
    - Ajoute la médaille dans la base de données.
    - Ajoute le rôle de la médaille au membre.
    - Publie un message dans le salon des médailles.
    - Réponse privée de confirmation.

### `/remove-medal`

Retire une médaille du profil d'un membre.

- Options :
    - `joueur` (obligatoire)
    - `medaille` (obligatoire, liste avec auto-complétion)
- Effet :
    - Retire la médaille dans la base de données.
    - Réponse privée de confirmation.

### `/set-rank`

Enregistre une promotion ou une démotion dans le registre.

- Options :
    - `joueur` (obligatoire)
    - `grade` (obligatoire, liste avec auto-complétion)
    - `raison` (obligatoire)
- Effet :
    - Met à jour le grade et le nom du membre dans la base de données.
    - Si le joueur était Cadet, son rôle est changé de "Sécurité du site" à "Xi-8".
    - Si le joueur repasse Cadet, son rôle est changé de "Xi-8" à "Sécurité du site".
    - Publie un message dans le salon des promotions/démotions.
    - Met à jour le pseudo du membre avec le nouveau grade.
    - Réponse privée de confirmation.

### `/status`

Renvoie le statut actuel du serveur.

- Effet :
    - Réponse privée avec un embed "Statut du serveur".

### `/display-status`

Affiche le statut du serveur dans le salon actuel.

- Effet :
    - Publie un message dans le salon avec un embed "Statut du serveur".
    - Réponse privée de confirmation.

## Règles importantes (basées sur le code)

- Le bot utilise les salons configurés pour les formations et les promotions/démotions.
- Pour `/add-training` et `/remove-training`, vous devez pouvoir écrire dans le salon des formations.
- Pour `/set-rank`, vous devez pouvoir écrire dans le salon des promotions/démotions.
- Pour `display-status`, vous devez pouvoir gérer les messages dans le salon actuel.
- Le bot attend un format de pseudo précis : `[Grade] F. Nom`.
    - Exemple : `[CPT] J. Dupont`
    - Si le format n'est pas respecté, la commande `/set-rank` échoue.

## Ce que le bot fait automatiquement

- Au démarrage, il synchronise tous les membres du serveur, et il met à jour son activité et les messages de statut.
- Il lit les derniers messages du salon des formations et enregistre les formations détectées.
- Il lit les derniers messages du salon des médailles et enregistre les médailles détectées.
- Quand un message est posté dans le salon des formations, il tente d'enregistrer la formation.
- Quand un message est posté dans le salon des médailles, il tente d'enregistrer la médaille.
- Quand un message est posté dans le salon des promotions/démotions, il tente de mettre à jour le grade.
- Quand un membre change de pseudo ou reçoit/perd certains rôles (Ξ-8, α-1), il synchronise son profil.
- À intervalles réguliers (toutes les minutes), il actualise l'activité du bot et les messages de statut.

## Problèmes courants

- "Failed to retrieve guild information" : l'ID du serveur n'est pas configuré.
- "Training channel not found" ou "Rank channel not found" : les salons ne sont pas configurés.
- Le pseudo ne se met pas à jour : le bot n'a pas la permission de modifier les pseudos.

Si le problème persiste, contactez l'équipe qui gère le bot.
