import { ApiError } from '@/shared/api/client';

// Maps backend ErrorCode enum names (com.example.phantom.exception.ErrorCode)
// to user-facing Russian messages. Keep in sync with the backend enum.
export const ERROR_MESSAGES: Record<string, string> = {
  // auth / user
  NOT_AUTHENTICATED: 'Требуется вход в аккаунт',
  INVALID_PASSWORD: 'Неверный пароль',
  WEAK_PASSWORD: 'Пароль слишком простой',
  INVALID_RECOVERY_KEY: 'Неверный ключ восстановления',
  BAD_RECOVERY_KEY: 'Некорректный формат ключа восстановления',
  USERNAME_TAKEN: 'Это имя пользователя уже занято',
  USER_NOT_FOUND: 'Пользователь не найден',
  EMPTY_REQUEST: 'Измените хотя бы одно поле',
  OWNER_KEY_REQUIRED: 'Требуется ключ владельца',
  NO_PERMISSION: 'Недостаточно прав',
  INFO_HIDDEN: 'Пользователь скрыл эту информацию',

  // wallet / finance
  INSUFFICIENT_BALANCE: 'Недостаточно средств',
  INVALID_AMOUNT: 'Некорректная сумма',
  INSUFFICIENT_WITHDRAWAL: 'Сумма вывода слишком мала',
  WALLET_NOT_FOUND: 'Кошелёк не найден',
  WITHDRAWAL_UNAVAILABLE: 'Вывод временно недоступен',

  // games / gating
  INVALID_BET: 'Некорректная ставка',
  INSUFFICIENT_EXPERIENCE: 'Недостаточный уровень для этого действия',
  BANNED: 'Вы заблокированы',
  RATE_LIMITED: 'Слишком часто — подождите немного',

  // chat / members
  CHAT_NOT_FOUND: 'Чат не найден',
  MESSAGE_NOT_FOUND: 'Сообщение не найдено',
  TOO_MANY_MEMBERS: 'В чате слишком много участников',
  ALREADY_ADDED: 'Этот игрок уже в чате',
  CANT_SELF_ADD: 'Нельзя добавить самого себя',
  CANT_SELF_KICK: 'Нельзя исключить самого себя',

  // disk / files
  FILE_NOT_FOUND: 'Файл не найден',
  FILENAME_TOO_LONG: 'Слишком длинное имя файла',
  DISK_QUOTA_EXCEEDED: 'Превышен лимит хранилища',
  DISK_USAGE_NOT_FOUND: 'Данные о хранилище не найдены',
  LENGTH_REQUIRED: 'Не удалось определить размер файла',

  // owner
  NOT_OWNER: 'Доступно только владельцу',
  OWNER_KEY_INVALID: 'Неверный ключ владельца',
  OWNER_KEY_MALFORMED: 'Некорректный формат ключа владельца',
  CANT_CHANGE_OWN_ROLE: 'Нельзя изменить свою роль',
  CANT_DELETE_SELF: 'Нельзя удалить свой аккаунт',
  ROLE_UNCHANGED: 'Пользователь уже имеет эту роль',
  BAD_MNEMONIC: 'Некорректная seed-фраза',
  MASTER_WALLET_NOT_SET: 'Мастер-кошелёк не задан',
  SWEEP_SCHEDULE_NOT_FOUND: 'Расписание сбора не задано',
  UNSUPPORTED_COIN: 'Монета не поддерживается',
  UPSTREAM_ERROR: 'Ошибка внешнего сервиса',

  // generic
  VALIDATION_ERROR: 'Проверьте правильность заполнения',
  MALFORMED_REQUEST: 'Некорректный запрос',
  ENDPOINT_NOT_FOUND: 'Ресурс не найден',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера',
};

const GENERIC = 'Что-то пошло не так, попробуйте ещё раз';

/** Resolve any thrown value to a friendly, user-facing message. */
export function errorMessage(error: unknown, fallback: string = GENERIC): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Нет соединения с сервером';
    if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
    if (error.message && error.message.trim()) return error.message;
  }
  return fallback;
}
