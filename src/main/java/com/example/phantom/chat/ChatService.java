package com.example.phantom.chat;

import com.example.phantom.chat.banlist.Ban;
import com.example.phantom.chat.banlist.BanRepository;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorAction;
import com.example.phantom.chat.chatmoderatoraction.ChatModeratorActionRepository;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ChatService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final MessageRepository messageRepository;
    private final BanRepository banRepository;
    private final ChatModeratorActionRepository chatModeratorActionRepository;

    public ChatService(UserRepository userRepository, WalletRepository walletRepository, MessageRepository messageRepository, BanRepository banRepository, ChatModeratorActionRepository chatModeratorActionRepository) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.messageRepository = messageRepository;
        this.banRepository = banRepository;
        this.chatModeratorActionRepository = chatModeratorActionRepository;
    }

    public List<MessageRepresentation> get(Integer limit, Long before) {
        Pageable pageable = PageRequest.of(0, limit);

        List<Message> messages = before != null
                ? messageRepository.findAllBeforeWithUsersPageable(before, pageable)
                : messageRepository.findAllWithUsersPageable(pageable);

        return messages.stream().map(MessageRepresentation::new).toList();
    }

    @Transactional
    public MessageRepresentation sendMessage(Long userId, SendMessageRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        Ban ban = banRepository.findById(userId).orElse(null);
        if (ban != null && ban.isActive()) {
            throw new ForbiddenException("you are banned");
        }

        if (!user.getRole().chatModeratorAccess()) {
            Wallet wallet = walletRepository.findById(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
            if (wallet.getDepositsSum().compareTo(ChatConstants.MIN_DEPOSITS_SUM) < 0) {
                throw new ForbiddenException("min deposits sum = " + ChatConstants.MIN_DEPOSITS_SUM);
            }
        }

        String content = request.getContent();

        Message message = new Message();
        message.setUser(user);
        message.setTimestamp(Instant.now().getEpochSecond());
        message.setContent(content);
        message = messageRepository.save(message);

        return new MessageRepresentation(message);
    }

    @Transactional
    public void deleteMessage(Long userId, Long messageId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        Message message = messageRepository.findById(messageId).orElseThrow(() -> new NotFoundException("message not found"));

        if (!Objects.equals(user.getId(), message.getUser().getId())) {
            if (user.getRole().chatModeratorAccess()) {
                if (message.getUser().getRole().chatModeratorAccess()) {
                    throw new ForbiddenException("you don't have permission to delete messages of this user");
                }
                ChatModeratorAction chatModeratorAction = new ChatModeratorAction();
                chatModeratorAction.setUser(user);
                chatModeratorAction.setTimestamp(Instant.now().getEpochSecond());
                chatModeratorAction.setAction("delete-message");
                chatModeratorAction.setData(Map.of(
                        "user_id", String.valueOf(message.getUser().getId()),
                        "message_content", message.getContent()
                ));
                chatModeratorActionRepository.save(chatModeratorAction);
            }
            else {
                throw new ForbiddenException("you don't have permission to delete other user messages");
            }
        }

        messageRepository.delete(message);
    }
}
