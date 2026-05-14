# Phantom

REST API for a gambling platform.

## Features
* JWT authentication
* Recovery keys
* User profiles (view, edit, delete)
* Rate limit
* Usage limit
* Wallets
* Deposits & withdrawals via crypto: TON
* Games: Upgrader, Cases
* Provably fair
* Sweep scheduling
* Sweep history
* Owner panel
* Chat for users who have deposited
* Chat moderators
* Chat moderator action history, can be read by everyone to prevent the role abuse

## Stack

Java 17, Spring Boot 3.5, Spring Security, Spring Data JPA, Hibernate, PostgreSQL, JJWT, Lombok, Gradle.

## API Endpoints

### Auth
| Method | Endpoint             | Description                                  |
|--------|----------------------|----------------------------------------------|
| POST   | `/api/auth/register` | Register a new account, returns recovery key |
| POST   | `/api/auth/login`    | Login, returns JWT token                     |
| POST   | `/api/auth/recover`  | Recover account credentials                  |

### Users
| Method | Endpoint                            | Description                 |
|--------|-------------------------------------|-----------------------------|
| GET    | `/api/users/me`                     | Get current user profile    |
| GET    | `/api/users/by-id/{id}`             | Get user by ID              |
| GET    | `/api/users/by-username/{username}` | Get user by username        |
| PATCH  | `/api/users/me`                     | Update display name         |
| PATCH  | `/api/users/me/secure`              | Change username or password |
| POST   | `/api/users/me/new-recovery-key`    | Regenerate recovery key     |
| DELETE | `/api/users/me`                     | Delete account              |
| GET    | `/api/users/stats`                  | Get users platform stats    |

### Usage limit
| Method | Endpoint           | Description     |
|--------|--------------------|-----------------|
| GET    | `/api/usage-limit` | Get your limits |

### Wallets
| Method | Endpoint                                           | Description               |
|--------|----------------------------------------------------|---------------------------|
| GET    | `/api/wallets/me`                                  | Get wallet info           |
| GET    | `/api/wallets/me/stats`                            | Get wallet stats          |
| GET    | `/api/wallets/me/history`                          | Get wallet history        |
| GET    | `/api/wallets/stats`                               | Get wallet platform stats |
| GET    | `/api/wallets/me/crypto/{coin}`                    | Get crypto wallet info    |
| POST   | `/api/wallets/me/crypto/{coin}/check-deposits`     | Check deposits            |
| POST   | `/api/wallets/me/crypto/{coin}/withdraw`           | Withdraw                  |
| POST   | `/api/wallets/me/crypto/check-pending-withdrawals` | Check pending withdrawals |

### Finances
| Method | Endpoint               | Description        |
|--------|------------------------|--------------------|
| GET    | `/api/finances/colors` | Get finance colors |

### Games
| Method | Endpoint                      | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | `/api/games/upgrader`         | Get upgrader settings        |
| POST   | `/api/games/upgrader/init`    | Start an upgrader game       |
| POST   | `/api/games/upgrader/run`     | Play the upgrader game       |
| GET    | `/api/games/upgrader/history` | Get upgrader game history    |
| DELETE | `/api/games/upgrader`         | Cancel active upgrader game  |
| GET    | `/api/games/cases`            | Get case settings and prices |
| POST   | `/api/games/cases/init`       | Start a case game            |
| POST   | `/api/games/cases/run`        | Open the case                |
| GET    | `/api/games/cases/history`    | Get case game history        |
| DELETE | `/api/games/cases`            | Cancel active case game      |
| GET    | `/api/games/stats`            | Get games platform stats     |
| GET    | `/api/games/stats/me`         | Get games personal stats     |

### Owner
| Method | Endpoint                        | Description                                     |
|--------|---------------------------------|-------------------------------------------------|
| POST   | `/api/owner/change-user-role`   | Change user role                                |
| GET    | `/api/owner/sweep/history`      | Get sweep history                               |
| GET    | `/api/owner/sweep/schedule`     | Get delay between sweeps in seconds             |
| POST   | `/api/owner/sweep/schedule`     | Set delay between sweeps                        |
| DELETE | `/api/owner/sweep/schedule`     | Disable sweeps                                  |
| GET    | `/api/owner/master-wallets/{coin}` | Get master wallet address & balance |
| POST   | `/api/owner/master-wallets/{coin}` | Set master wallet mnemonic          |

### Chat
| Method | Endpoint                                    | Description                           |
|--------|---------------------------------------------|---------------------------------------|
| GET    | `/api/chat`                                 | Get messages                          |
| POST   | `/api/chat`                                 | Send message                          |
| DELETE | `/api/chat/{messageId}`                     | Delete message                        |
| GET    | `/api/chat/banlist/me`                      | Get current user ban information      |
| GET    | `/api/chat/banlist/{userId}`                | Get ban information by user id        |
| POST   | `/api/chat/banlist/{targetId}`              | Ban user                              |
| DELETE | `/api/chat/banlist/{targetId}`              | Unban user                            |
| GET    | `/api/chat/chat-moderator-actions`          | Get chat moderator actions            |

## Building

**Requirements:** Java 17, Gradle, PostgreSQL

1. Create a PostgreSQL database:
```sql
CREATE DATABASE phantom;
```

2. Set environment variables:
```
DB_USER=<your_db_user>
DB_PASSWORD=<your_db_password>
JWT_SECRET=<base64_encoded_secret_min_32_bytes>
OWNER_KEY=<base64_encoded_key_min_32_bytes>
TON_API_KEY=<your_ton_api_key>
```

On Windows, you can generate random base64 with PowerShell:
```
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

You can get your `TON_API_KEY` here:
```
Telegram, @toncenter
```

3. Run:
```
./gradlew bootRun
```

## Getting started
1. Register an `OWNER` account with an `OWNER_KEY`
2. Login
3. Set master wallets

## For production use (important)
* Use full disk encryption (LUKS, BitLocker)
* Use HTTPS
