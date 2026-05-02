# Phantom

REST API for a gambling platform. Users deposit USDT (TRC-20), play games with cryptographically verifiable outcomes, and withdraw winnings to any Tron wallet.

## Stack

Java 17, Spring Boot 3.5, Spring Security, Spring Data JPA, Hibernate, PostgreSQL, JJWT, Tron/Trident SDK, Web3j, Lombok, Gradle.

## Features

- **Authentication** — JWT-based auth with BCrypt password hashing
- **User profiles** — view, edit, delete accounts
- **Wallets** — each user gets an auto-generated Tron wallet on registration
- **Deposits** — USDT TRC-20 deposits
- **Withdrawals** — USDT TRC-20 withdrawals
- **Provably fair** — SHA-256 based verifiable randomness
- **Games** — Upgrader, Cases

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new account |
| POST | `/api/auth/login` | Login, returns JWT token |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| GET | `/api/users/by-id/{id}` | Get user by ID |
| GET | `/api/users/by-username/{username}` | Get user by username |
| PATCH | `/api/users/me` | Update display name |
| PATCH | `/api/users/me/secure` | Change username or password |
| DELETE | `/api/users/me` | Delete account |

### Wallet
| Method | Endpoint                           | Description                         |
|--------|------------------------------------|-------------------------------------|
| GET | `/api/wallet`                      | Get wallet info and deposit address |
| POST | `/api/wallet/check-deposit/{txId}` | Confirm deposit                     |
| POST | `/api/wallet/withdrawal/init`      | Initiate a withdrawal               |
| POST | `/api/wallet/withdrawal/check`     | Check withdrawal statuses           |

### Games
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List available games |
| GET | `/api/games/upgrader` | Get upgrader settings |
| POST | `/api/games/upgrader/init` | Start an upgrader game |
| POST | `/api/games/upgrader/run` | Play the upgrader game |
| DELETE | `/api/games/upgrader` | Cancel active upgrader game |
| GET | `/api/games/cases` | Get case settings and prices |
| POST | `/api/games/cases/init` | Start a case game |
| POST | `/api/games/cases/run` | Open the case |
| DELETE | `/api/games/cases` | Cancel active case game |

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
JWT_EXPIRATION_MS=86400000
TRON_MASTER_MNEMONIC=<your_mnemonic_phrase>
TRON_MASTER_FEE_LIMIT=12500000
```

3. Run:
```
./gradlew bootRun
```