# Phantom API Endpoint Inventory

## Legend

| Symbol | Meaning |
|--------|---------|
| `*` | Requires authentication (JWT cookie `token` or `Authorization: Bearer <token>`) |
| `[MOD]` | Requires `CHAT_MODERATOR` or `OWNER` role (`chatModeratorAccess = true`) |
| `[OWNER]` | Requires `OWNER` role (`ownerAccess = true`) |
| `[XP-GATE]` | Feature gated behind an XP level (see Experience / Levels) |
| `?param` | Optional query parameter |

All paths are relative to the server root. The Vite dev proxy forwards `/api/**` and `/ws` to the backend.

Cursor-based pagination convention: `limit` (default 20) + `before` (exclusive upper bound ID or timestamp) unless noted otherwise.

---

## Auth — `AuthController` (`/api/auth`)

| Method | Path | Auth | Request body | Response | Purpose |
|--------|------|------|-------------|----------|---------|
| POST | `/api/auth/register` | — | `RegisterRequest` + `?refId` (Long) | `{ token: string }` (201) | Register a new user; optional referrer ID |
| POST | `/api/auth/login` | — | `LoginRequest` | `{ token: string }` + sets `token` HttpOnly cookie | Authenticate and receive JWT |
| POST | `/api/auth/recover` | — | `RecoverRequest` | `{ token?: string }` | Recover account using recovery key |

### DTOs

**`RegisterRequest`**
```
username       String (pattern: USERNAME_PATTERN, min/max USERNAME_MIN/MAX_LENGTH)
displayName    String (min/max DISPLAY_NAME_MIN/MAX_LENGTH)
password       String (min/max PASSWORD_MIN/MAX_LENGTH)
ownerKey?      String (max 256) — bootstraps OWNER role on first register
role?          Role enum (USER | CHAT_MODERATOR | OWNER)
```

**`LoginRequest`**
```
username   String
password   String
```

**`RecoverRequest`**
```
recoveryKey   String (exact RECOVERY_KEY_LENGTH)
newUsername?  String
newPassword?  String
```

---

## Users — `UserController` (`/api/users`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/users/roles` | — | — | `RoleRepresentation[]` | List all roles and their capability flags |
| GET | `/api/users/me` | `*` | — | `UserFullRepresentation` | Get own profile |
| GET | `/api/users/by-id/{userId}` | — | path: `userId` Long | `UserFullRepresentation` | Get public profile by numeric ID |
| GET | `/api/users/by-username/{username}` | — | path: `username` String | `UserFullRepresentation` | Get public profile by username |
| PATCH | `/api/users/me` | `*` | `PatchMeRequest` | `{ message: string }` | Update display name and privacy settings |
| PATCH | `/api/users/me/secure` | `*` | `PatchMeSecureRequest` | `{ message: string }` | Change username or password (requires current password) |
| POST | `/api/users/me/new-recovery-key` | `*` | `PasswordRequest` | `{ recoveryKey: string }` | Generate a new recovery key |
| DELETE | `/api/users/me` | `*` | `PasswordRequest` | 204 | Delete own account (requires password) |
| GET | `/api/users/stats` | — | — | `UserStatRepresentation` | Platform-wide user count statistics |

### DTOs

**`UserFullRepresentation`**
```
id                        Long
username                  String
displayName               String
registeredAt              Long (epoch seconds)
role                      Role enum
gameHistoryPrivacySetting PrivacySetting (EVERYONE | ONLY_YOU)
gameStatsPrivacySetting   PrivacySetting
experiencePrivacySetting  PrivacySetting
lotteryPrivacySetting     PrivacySetting
```

**`UserShortRepresentation`** (embedded in many responses)
```
id          Long
displayName String
role        Role enum
```

**`RoleRepresentation`**
```
name                 String
chatModeratorAccess  Boolean
ownerAccess          Boolean
```

**`UserStatRepresentation`**
```
totalUsers    Long
totalUsers24h Long
```

**`PatchMeRequest`**
```
displayName?               String
gameHistoryPrivacySetting? PrivacySetting
gameStatsPrivacySetting?   PrivacySetting
experiencePrivacySetting?  PrivacySetting
lotteryPrivacySetting?     PrivacySetting
```

**`PatchMeSecureRequest`**
```
currentPassword  String (required)
username?        String
password?        String
```

**`PasswordRequest`**
```
password  String (required)
```

---

## Wallet — `WalletController` (`/api/wallets`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/wallets/me` | `*` | — | `WalletRepresentation` | Get own internal (platform) wallet balance |

### DTOs

**`WalletRepresentation`**
```
id       Long
balance  BigDecimal
```

---

## Crypto — `CryptoController` (`/api/wallets/me/crypto`)

All endpoints require authentication. `{coin}` is a `CoinType` enum value (currently only `TON`).

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/wallets/me/crypto/{coin}` | `*` | path: `coin` | `CryptoWalletRepresentation` | Get on-chain deposit address for the coin |
| POST | `/api/wallets/me/crypto/{coin}/check-deposits` | `*` | path: `coin` | `DepositRepresentation[]` | Poll chain for new deposits and credit wallet |
| POST | `/api/wallets/me/crypto/{coin}/withdraw` | `*` | path: `coin`, body: `WithdrawRequest` | `WithdrawalRepresentation` | Initiate an on-chain withdrawal |
| POST | `/api/wallets/me/crypto/check-pending-withdrawals` | `*` | — | `WithdrawalRepresentation[]` | Check and update status of pending withdrawals |

### DTOs

**`CryptoWalletRepresentation`**
```
coin     CoinType enum
address  String
```

**`DepositRepresentation`**
```
id        Long
coin      CoinType enum
timestamp Long (epoch seconds)
txHash    String
amount    BigDecimal
```

**`WithdrawRequest`**
```
address  String (required, not blank)
amount   BigDecimal (required, positive)
```

**`WithdrawalRepresentation`**
```
id        Long
user      UserShortRepresentation
coin      CoinType enum
timestamp Long
receiver  String
amount    BigDecimal
status    TransferStatus enum
hash      String (nullable)
```

---

## Finance — `FinanceController` (`/api/finances`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/finances/colors` | — | — | `FinanceColors` | Amount-to-colour thresholds for transaction display |

### DTOs

**`FinanceColors`** (all BigDecimal thresholds)
```
grey    BigDecimal (0)
blue    BigDecimal (0.1)
purple  BigDecimal (1)
pink    BigDecimal (15)
red     BigDecimal (100)
gold    BigDecimal (1000)
```

---

## Games — `GameController` (`/api/games`)

`{game}` is a `GameType` enum: `CASES`, `UPGRADER`, `COINFLIP`, `FRUITS`.

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/games/{game}` | — | path: `game` | `GameSettings` (game-specific) | Get current game configuration/limits |
| POST | `/api/games/{game}/init` | `*` | path: `game`, body: `GameInitRequest` | `GameInitRepresentation` | Initialise a provably-fair round (returns server hash) |
| POST | `/api/games/{game}/run` | `*` | path: `game`, body: `GameRunRequest` | `GameRepresentation` | Submit client seed and resolve the round |
| DELETE | `/api/games/{game}` | `*` | path: `game` | 204 | Cancel/discard the pending round |
| GET | `/api/games/history/{targetId}` | `*` | path: `targetId` Long, `?limit`, `?before` Long | `GameRepresentation[]` | Get a user's game history (privacy-gated) |
| GET | `/api/games/history` | `*` | `?limit`, `?before` Long | `GameRepresentation[]` | Get platform-wide recent game feed |
| GET | `/api/games/stats/{targetId}` | `*` | path: `targetId` Long | `UserGameStatRepresentation` | Get a user's game statistics (privacy-gated) |
| GET | `/api/games/stats` | — | — | `PlatformGameStatRepresentation` | Get platform-wide game statistics |

### DTOs

**`GameInitRequest`**
```
data  Map<String, String> (required) — game-specific parameters (bet, case selection, etc.)
```

**`GameInitRepresentation`**
```
serverHash  String
data        Map<String, Object> (nullable, game-specific)
```

**`GameRunRequest`**
```
clientSeed  String (exact SEED_LENGTH characters, required)
```

**`GameRepresentation`**
```
id          Long
user        UserShortRepresentation
gameType    GameType enum
timestamp   Long
bet         BigDecimal
result      BigDecimal
serverSeed  String
clientSeed  String
data        Map<String, Object> (game-specific outcome data)
```

**`UserGameStatRepresentation`**
```
totalGames  Long
maxWin      BigDecimal
```

**`PlatformGameStatRepresentation`**
```
totalGames    Long
totalGames24h Long
maxWin        BigDecimal
maxWin24h     BigDecimal
```

---

## Lottery — `LotteryController` (`/api/lottery`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/lottery/current` | `*` | — | `CurrentLotteryRepresentation` | Get the active lottery round (personal ticket count included) |
| GET | `/api/lottery/history` | `*` | `?limit`, `?before` Long | `FinishedLotteryRepresentation[]` | List completed lottery rounds |
| GET | `/api/lottery/{id}/bets` | `*` | path: `id` Long, `?limit`, `?beforeTickets` Long, `?beforeId` Long | `LotteryBetRepresentation[]` | List bets for a specific lottery round |
| POST | `/api/lottery/buy-tickets` | `*` | `LotteryTicketAmountRequest` | `{ message: string }` | Purchase lottery tickets for the current round |
| POST | `/api/lottery/refund-tickets` | `*` | `LotteryTicketAmountRequest` | `{ message: string }` | Refund lottery tickets for the current round |

### DTOs

**`LotteryTicketAmountRequest`**
```
amount  Long (required, min 1)
```

**`CurrentLotteryRepresentation`**
```
id                    Long
timestampStart        Long
timestampBlock        Long
timestampEnd          Long
seed1Hash             String
seed2Hash             String
ticketCost            BigDecimal
ticketsAmountPersonal Long
ticketsAmountTotal    Long
costPersonal          BigDecimal
costTotal             BigDecimal
```

**`FinishedLotteryRepresentation`**
```
id           Long
timestamp    Long
seed1        String
seed2        String
user         UserShortRepresentation (winner)
happyTicket  Long
prize        BigDecimal
ticketsSold  Long
```

**`LotteryBetRepresentation`**
```
id      Long
user    UserShortRepresentation
tickets Long
```

---

## Chat: Chats — `ChatController` (`/api/chat/chats`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| POST | `/api/chat/chats` | `*` | — | `ChatRepresentation` | Create a new direct chat |
| GET | `/api/chat/chats` | `*` | `?limit`, `?beforeTimestamp` Long, `?beforeId` Long | `ChatRepresentation[]` | List own chats |
| GET | `/api/chat/chats/{chatId}` | `*` | path: `chatId` Long | `ChatRepresentation` | Get a single chat |
| POST | `/api/chat/chats/{chatId}/leave` | `*` | path: `chatId` Long | 200 | Leave a chat |
| DELETE | `/api/chat/chats/{chatId}` | `*` | path: `chatId` Long | 204 | Delete a chat (owner only) |
| POST | `/api/chat/chats/{chatId}/kick/{targetId}` | `*` | path: `chatId` Long, `targetId` Long | `ChatRepresentation` | Remove a member from a chat |
| POST | `/api/chat/chats/{chatId}/add/{targetId}` | `*` | path: `chatId` Long, `targetId` Long | `ChatRepresentation` | Add a member to a chat |

### DTOs

**`ChatRepresentation`**
```
id        String
topicId   String
timestamp Long
members   TopicMemberRepresentation[]
```

**`TopicMemberRepresentation`** (embedded)
```
id        Long
user      UserShortRepresentation
timestamp Long
```

---

## Chat: Messages — `MessageController` (`/api/chat/messages`)

`chatId=1` is the public global chat.

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/chat/messages` | `*` | `?chatId` Long (default 1), `?limit`, `?before` Long | `MessageRepresentation[]` | List messages in a chat |
| POST | `/api/chat/messages` | `*` | `SendMessageRequest` | `MessageRepresentation` | Send a message; `[XP-GATE]` Echo level required for global chat |
| DELETE | `/api/chat/messages/{messageId}` | `*` | path: `messageId` Long | 204 | Delete own message (moderators can delete any) |

### DTOs

**`SendMessageRequest`**
```
content       String (required, max MAX_MESSAGE_CONTENT_LENGTH)
chatId        Long (default 1)
attachmentId? UUID (disk file id)
```

**`MessageRepresentation`**
```
id          Long
chatId      String
user        UserShortRepresentation
timestamp   Long
content     String
attachment  FileRepresentation (nullable)
```

---

## Chat: Ban List — `BanlistController` (`/api/chat/banlist`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/chat/banlist/me` | `*` | — | `BanRepresentation` | Get own ban record |
| GET | `/api/chat/banlist/{userId}` | — | path: `userId` Long | `BanRepresentation` | Get ban record for any user |
| POST | `/api/chat/banlist/{targetId}` | `*` `[MOD]` | path: `targetId` Long, body: `BanRequest` | `{ message: string }` | Ban a user from chat |
| DELETE | `/api/chat/banlist/{targetId}` | `*` `[MOD]` | path: `targetId` Long, body: `UnbanRequest` | 204 | Unban a user from chat |

### DTOs

**`BanRequest`**
```
reason    String (required, not blank, max MAX_REASON_LENGTH)
duration  Long (required, positive — seconds)
```

**`UnbanRequest`**
```
reason  String (required, not blank, max MAX_REASON_LENGTH)
```

**`BanRepresentation`**
```
id         Long
timestamp  Long
moderator  UserShortRepresentation (nullable)
duration   Long (seconds)
reason     String
```

---

## Chat: Blacklist — `BlacklistController` (`/api/chat/blacklists`)

Personal block-list (hides messages from blocked users).

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/chat/blacklists` | `*` | `?limit`, `?before` Long | `BlacklistRepresentation` | Get own blacklisted users |
| POST | `/api/chat/blacklists/{targetId}` | `*` | path: `targetId` Long | 200 | Block a user |
| DELETE | `/api/chat/blacklists/{targetId}` | `*` | path: `targetId` Long | 204 | Unblock a user |

### DTOs

**`BlacklistRepresentation`**
```
users  UserShortRepresentation[]
```

---

## Chat: Moderator Actions — `ChatModeratorActionController` (`/api/chat/chat-moderator-actions`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/chat/chat-moderator-actions` | `*` | `?limit`, `?before` Long | `ChatModeratorActionRepresentation[]` | List moderation action log (any authenticated user can read) |

### DTOs

**`ChatModeratorActionRepresentation`**
```
id        Long
user      UserShortRepresentation (nullable)
timestamp Long
type      ChatModeratorActionType enum
data      Map<String, String>
```

---

## Disk (File Storage) — `DiskController` (`/api/disk`)

`[XP-GATE]` Uploading requires Echo level (base quota) or Phantom level (plus quota).

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/disk/settings` | — | — | `DiskSettings` | Get quota limits (base and plus tiers) |
| GET | `/api/disk/files` | `*` | `?before` Long, `?limit` | `FileRepresentation[]` | List own uploaded files |
| POST | `/api/disk/files` | `*` `[XP-GATE]` | multipart `file`, `?useImageCompression` Boolean (default true) | `FileRepresentation` | Upload a file |
| GET | `/api/disk/files/{id}` | `*` | path: `id` UUID | binary stream (attachment) | Download a file by UUID |
| DELETE | `/api/disk/files/{id}` | `*` | path: `id` UUID | 204 | Delete a file |
| GET | `/api/disk/usage/personal` | `*` | — | `DiskQuota` | Get own disk usage |
| GET | `/api/disk/usage/platform` | — | — | `DiskQuota` | Get platform-wide disk usage |

### DTOs

**`DiskSettings`**
```
baseRule  DiskQuota  (1 GB / 10 000 files)
plusRule  DiskQuota  (10 GB / 100 000 files)
```

**`DiskQuota`**
```
size   Long (bytes)
files  Long (file count)
```

**`FileRepresentation`**
```
id        UUID
timestamp Long
user      UserShortRepresentation
name      String (original filename)
size      Long (bytes)
```

---

## Presents — `PresentController` (`/api/presents`)

`[XP-GATE]` Sending requires Echo level.

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/presents` | `*` | `?claimed` Boolean, `?limit`, `?before` Long | `PresentRepresentation[]` | List own presents (filter by claimed status) |
| GET | `/api/presents/count` | `*` | `?claimed` Boolean | `{ count: string }` | Count own presents |
| POST | `/api/presents/send` | `*` `[XP-GATE]` | `SendPresentRequest` | 200 | Send a present to another user |
| POST | `/api/presents/claim` | `*` | `ClaimPresentRequest` | `PresentRepresentation` | Claim a specific present |
| POST | `/api/presents/claim-all` | `*` | — | `{ message: string }` | Claim all unclaimed presents at once |

### DTOs

**`SendPresentRequest`**
```
amount       BigDecimal (required, min MIN_TO_SEND)
description? String (max MAX_DESCRIPTION_LENGTH)
anonymous    Boolean (required)
receiverId   Long (required)
```

**`ClaimPresentRequest`**
```
presentId  Long (required)
```

**`PresentRepresentation`**
```
id          Long
claimed     Boolean
timestamp   Long
amount      BigDecimal
description String
sender      UserShortRepresentation (nullable if anonymous)
```

---

## Experience & Levels — `ExperienceController` (`/api/experience`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/experience/levels` | — | — | `LevelRepresentation[]` | List all XP levels and their feature unlocks |
| GET | `/api/experience/{targetId}` | `*` | path: `targetId` Long | `ExperienceRepresentation` | Get experience for a user (privacy-gated) |
| GET | `/api/experience/batch` | `*` | `?ids` Set\<Long\> | `Map<Long, ExperienceRepresentation>` | Batch fetch experience for multiple user IDs |
| GET | `/api/experience/{targetId}/history` | `*` | path: `targetId` Long, `?limit`, `?before` Long | `ExperienceChangeRepresentation[]` | Get XP change history for a user |
| GET | `/api/experience/leaderboard` | `*` | `?limit`, `?beforeAmount` Long, `?beforeUserId` Long | `LeaderboardEntryRepresentation[]` | XP leaderboard with cursor pagination |

### DTOs

**`LevelRepresentation`**
```
name      String (enum name: Whisper, Echo, Shade, Wisp, Spectre, Phantom, Revenant, Reaper)
amount    Long (XP threshold)
features  Set<LevelFeature> (e.g. SEND_MESSAGE, SEND_PRESENT, DISK_BASE, DISK_PLUS)
```

**`ExperienceRepresentation`**
```
id      Long
level   Level enum (nullable if below lowest threshold)
amount  Long (current XP)
next    Long (XP needed for next level, nullable at max level)
```

**`ExperienceChangeRepresentation`**
```
id        Long
amount    Long
type      ExperienceChangeType enum
timestamp Long
details   String
```

**`LeaderboardEntryRepresentation`**
```
user        UserShortRepresentation
experience  ExperienceRepresentation
```

---

## Referral — `RefController` (`/api/ref`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/ref` | `*` | — | `RefStorageRepresentation` | Get own referral earnings storage |
| GET | `/api/ref/members` | `*` | `?limit`, `?before` Long | `UserShortRepresentation[]` | List users who registered via own referral link |
| POST | `/api/ref/claim` | `*` | — | `RefStorageRepresentation` | Claim accumulated referral earnings |

Registration uses referral link: `POST /api/auth/register?refId={userId}`.

### DTOs

**`RefStorageRepresentation`**
```
id      Long
amount  BigDecimal (claimable balance)
total   BigDecimal (all-time earned)
```

---

## Notifications — `NotificationController` (`/api/notifications`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/notifications` | `*` | `?topicId` String, `?before` Long, `?limit` | `NotificationRepresentation[]` | List own notifications, optionally filtered by topic |

### DTOs

**`NotificationRepresentation`**
```
id        Long
timestamp Long
type      NotificationType enum
payload   Object (type-dependent JSON)
```

**`NotificationType` values**
`PRESENT_RECEIVED`, `BANNED`, `UNBANNED`, `YOUR_MESSAGE_DELETED`, `MESSAGE_RECEIVED`, `MESSAGE_DELETED`, `NEW_CHAT`, `ROLE_CLAIMED`, `WELCOME`, `LEVEL_UP`, `BROADCAST`, `LOTTERY_IS_ENDING`, `LOTTERY_ENDED`, `YOU_WON_LOTTERY`, `MASTER_WALLET_SET`, `SWEEP_SCHEDULE_SET`, `NEW_SWEEP`, `NEW_WITHDRAWAL`, `WITHDRAWAL_FAILED`

---

## Notification Topics — `TopicController` (`/api/notifications/topics`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/notifications/topics` | `*` | `?limit`, `?before` String (topic ID cursor) | `String[]` (topic IDs) | List topic IDs the user is subscribed to |

---

## Broadcast — `BroadcastController` (`/api/broadcast`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| POST | `/api/broadcast` | `*` `[MOD]` | `BroadcastRequest` | 200 | Send a broadcast message to all authenticated-topic subscribers |

### DTOs

**`BroadcastRequest`**
```
content  String (required, max MAX_CONTENT_SIZE)
```

The notification is pushed via WebSocket as `NotificationType.BROADCAST` with payload `BroadcastRepresentation { user: UserShortRepresentation, content: String }`.

---

## Rate Limit — `RateLimitController` (`/api/rate-limit`)

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/rate-limit` | `*` | — | `RateLimitRepresentation` | Get current rate limit state for all actions |

### DTOs

**`RateLimitRepresentation`**
```
data  Map<String, RateLimitActionRepresentation>
```

**`RateLimitActionRepresentation`**
```
timestamp    Long
seconds      Long
tokensSpent  Long
tokensTotal  Long
```

---

## Owner — `OwnerController` (`/api/owner`)

All endpoints require `[OWNER]` role.

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| POST | `/api/owner/change-user-role` | `*` `[OWNER]` | `ChangeUserRoleRequest` | `{ message: string }` | Change another user's role (promoting to/from OWNER requires `ownerKey`) |
| GET | `/api/owner/withdrawals/history` | `*` `[OWNER]` | `?limit`, `?before` Long | `WithdrawalRepresentation[]` | List all platform withdrawal records |

### DTOs

**`ChangeUserRoleRequest`**
```
targetId   Long (required)
role       Role enum (required)
ownerKey?  String (max 255) — required when promoting to/from OWNER role
```

---

## Owner: Master Wallets — `MasterWalletController` (`/api/owner/master-wallets`)

All endpoints require `[OWNER]` role. `{coin}` = `CoinType` enum (currently `TON`).

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/owner/master-wallets/{coin}` | `*` `[OWNER]` | path: `coin` | `MasterWalletRepresentation` | Get master wallet address and balance for a coin |
| POST | `/api/owner/master-wallets/{coin}` | `*` `[OWNER]` | path: `coin`, body: `SetMasterWalletRequest` | `{ message: string }` | Set or replace the master wallet mnemonic for a coin |

### DTOs

**`SetMasterWalletRequest`**
```
mnemonic  String (required, not blank, max 500)
```

**`MasterWalletRepresentation`**
```
address  String
balance  BigDecimal
```

---

## Owner: Sweep — `SweepController` (`/api/owner/sweep`)

All endpoints require `[OWNER]` role. The sweep job consolidates user deposit wallets into the master wallet.

| Method | Path | Auth | Request | Response | Purpose |
|--------|------|------|---------|----------|---------|
| GET | `/api/owner/sweep/history` | `*` `[OWNER]` | `?limit`, `?before` Long | `SweepLogRepresentation[]` | List sweep operation log |
| GET | `/api/owner/sweep/schedule` | `*` `[OWNER]` | — | `{ seconds: string }` | Get current sweep interval in seconds |
| POST | `/api/owner/sweep/schedule` | `*` `[OWNER]` | `SetScheduleRequest` | `{ message: string }` | Set sweep interval |
| DELETE | `/api/owner/sweep/schedule` | `*` `[OWNER]` | — | 204 | Remove the sweep schedule (disable automatic sweeps) |

### DTOs

**`SetScheduleRequest`**
```
seconds  Long (required, min MIN_DELAY, max MAX_DELAY)
```

**`SweepLogRepresentation`**
```
id        Long
timestamp Long
coin      CoinType enum
sender    String (user deposit address)
amount    BigDecimal
receiver  String (master wallet address)
status    String ("ok" | "failed")
hash      String (tx hash, nullable)
```

---

## SPA Catch-all — `SpaController`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/{path}` | — | Forward all non-file, non-`/ws` paths to `/index.html` for SPA routing |
| GET | `/{path}/{subpath}` | — | Same, one level deeper |

---

## Realtime — WebSocket (STOMP)

**Connection endpoint:** `ws://<host>/ws` (no SockJS; raw STOMP over WebSocket)

**Authentication:** Send JWT in the STOMP `CONNECT` frame header `Authorization: Bearer <token>` (handled by `StompAuthChannelInterceptor`).

**Broker prefix:** `/topic` (server-push only; no client `SEND` via `/app` is mapped in the codebase).

**Application destination prefix:** `/app` (configured but no `@MessageMapping` handlers exist — all server events are push-only).

### Server-push destinations

| Destination | Subscriber | Payload | Triggered by |
|-------------|-----------|---------|-------------|
| `/topic/users/{userId}` | The specific user | `NotificationRepresentation` | Any user-targeted notification (presents, bans, messages, XP level-up, withdrawals, etc.) |
| `/topic/{topicId}` | Topic members | `NotificationRepresentation` | Topic-scoped notifications (new chat message, broadcast, lottery events, sweep events, etc.) |

The `topicId` for the global public channel (all authenticated users) and the owners-only channel are managed by `GlobalTopicService`. Private chat topics correspond to `ChatRepresentation.topicId`. The list of topic IDs a user belongs to is available via `GET /api/notifications/topics`.
