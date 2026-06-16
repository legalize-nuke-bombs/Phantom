# Phantom

REST API for a gambling platform.

## Features
* JWT authentication
* Recovery keys
* User profiles (view, edit, delete)
* User experience system
* Referral system
* Stats & history
* WebSocket & notifications
* User privacy settings
* Rate limit
* Wallets
* Presents system
* Deposits & withdrawals via crypto: TON
* Games: Upgrader, Cases, Coinflip, Fruits (Slots)
* Lottery
* Provably fair
* Sweep scheduling
* Sweep history
* Owner panel
* Chat
* Chat moderators
* Chat moderator action history, can be read by everyone to prevent the role abuse
* Disk
* Chat attachments
* OpenAPI

## Tech Stack

Java 17, Spring Boot 3.5, Spring Security, Spring Data JPA, Spring WebSocket, Hibernate, PostgreSQL, JJWT, Lombok, Gradle.

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
DISK_ROOT=<your_disk_root>
SPRING_MULTIPART_CACHE_ROOT=<your_spring_multipart_cache_root>
LOGS_ROOT=<your_logs_root>
```

Cloudflare is blocked in some regions. In this case, set up a proxy:
```
JAVA_TOOL_OPTIONS=-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=10801 -Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=10801
```


On Windows, you can generate random base64 key with PowerShell:
```
Add-Type -AssemblyName System.Security
[Reflection.Assembly]::LoadWithPartialName("System.Security")
$rijndael = new-Object System.Security.Cryptography.RijndaelManaged
$rijndael.GenerateKey()
Write-Host([Convert]::ToBase64String($rijndael.Key))
$rijndael.Dispose()
```

You can get your `TON_API_KEY` here:
```
Telegram @toncenter
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
