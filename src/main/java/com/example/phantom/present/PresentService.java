package com.example.phantom.present;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class PresentService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final PresentRepository presentRepository;
    private final RateLimitService rateLimitService;
    private final NotificationPublishService notificationPublishService;

    public PresentService(UserRepository userRepository, WalletService walletService, PresentRepository presentRepository, RateLimitService rateLimitService, NotificationPublishService notificationPublishService) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.presentRepository = presentRepository;
        this.rateLimitService = rateLimitService;
        this.notificationPublishService = notificationPublishService;
    }

    public List<PresentRepresentation> get(Long userId, Boolean claimed, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        List<Present> presents = presentRepository.findByReceiverIdClaimedWithSenders(user.getId(), claimed, before, PageRequest.of(0, limit));
        List<User> senders = presents.stream().map(Present::getSender).toList();

        Map<Long, UserShortRepresentation> senderMap = senders.stream().filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toMap(User::getId, UserShortRepresentation::new, (a, b) -> a));

        return presents.stream().map(k -> new PresentRepresentation(k, k.getSender() != null ? senderMap.get(k.getSender().getId()) : null)).toList();
    }

    public Map<String, String> count(Long userId, Boolean claimed) {
        return Map.of("result", String.valueOf(presentRepository.countByReceiverIdClaimed(userId, claimed)));
    }

    @Transactional
    public Void send(Long userId, SendPresentRequest request) {
        BigDecimal amount = request.getAmount();
        String description = request.getDescription();
        Long receiverId = request.getReceiverId();
        Boolean anonymous = request.getAnonymous();

        if (Objects.equals(userId, receiverId)) {
            throw new ApiException(ErrorCode.CANT_SELF_SEND);
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        User receiver = userRepository.findById(receiverId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        rateLimitService.startAction(user.getId(), RateLimitAction.SEND_PRESENT, 1);

        Wallet wallet = walletService.lock(userId);

        if (wallet.getBalanceCached().compareTo(amount) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }
        walletService.addChange(wallet, amount.negate());

        Present present = new Present();
        present.setClaimed(false);
        present.setTimestamp(Instant.now().getEpochSecond());
        present.setAmount(amount);
        present.setDescription(description != null ? description : "");
        if (!anonymous) present.setSender(user);
        present.setReceiver(receiver);
        presentRepository.save(present);

        notificationPublishService.createUserNotification(receiver, NotificationType.PRESENT_RECEIVED, new PresentRepresentation(present, anonymous ? null : new UserShortRepresentation(user)));

        return null;
    }

    @Transactional
    public PresentRepresentation claim(Long userId, ClaimPresentRequest request) {
        Long presentId = request.getPresentId();

        Present present = presentRepository.findByIdForPessimisticWrite(presentId).orElseThrow(() -> new ApiException(ErrorCode.PRESENT_NOT_FOUND));
        if (!Objects.equals(userId, present.getReceiver().getId())) {
            throw new ApiException(ErrorCode.PRESENT_NOT_FOUND);
        }
        if (present.getClaimed()) {
            throw new ApiException(ErrorCode.PRESENT_ALREADY_CLAIMED);
        }

        Wallet wallet = walletService.lock(userId);

        present.setClaimed(true);
        present = presentRepository.save(present);

        walletService.addChange(wallet, present.getAmount());

        return new PresentRepresentation(present, present.getSender() != null ? new UserShortRepresentation(present.getSender()) : null);
    }

    @Transactional
    public Map<String, String> claimAll(Long userId) {
        List<Present> presents = presentRepository.findByReceiverIdClaimedForPessimisticWrite(userId, false);

        if (presents.isEmpty()) {
            return Map.of("result", "0");
        }

        BigDecimal sum = BigDecimal.ZERO;
        for (Present present : presents) {
            present.setClaimed(true);
            sum = sum.add(present.getAmount());
        }
        presentRepository.saveAll(presents);

        Wallet wallet = walletService.lock(userId);
        walletService.addChange(wallet, sum);

        return Map.of("result", sum.toString());
    }
}
