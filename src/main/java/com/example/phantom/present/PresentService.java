package com.example.phantom.present;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
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
    private final UsageLimitService usageLimitService;
    private final ProfileService profileService;

    public PresentService(UserRepository userRepository, WalletService walletService, PresentRepository presentRepository, UsageLimitService usageLimitService, ProfileService profileService) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.presentRepository = presentRepository;
        this.usageLimitService = usageLimitService;
        this.profileService = profileService;
    }

    public List<PresentRepresentation> get(Long userId, Boolean claimed, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        List<Present> presents = presentRepository.findByReceiverIdClaimedWithSenders(user.getId(), claimed, before, PageRequest.of(0, limit));
        List<User> senders = presents.stream().map(Present::getSender).toList();

        Map<Long, ProfileCardRepresentation> profileCardMap = profileService.getCardsForUsers(userId, senders);

        return presents.stream().map(k -> new PresentRepresentation(k, k.getSender() != null ? profileCardMap.get(k.getSender().getId()) : null)).toList();
    }

    public Map<String, String> count(Long userId, Boolean claimed) {
        return Map.of("result", String.valueOf(presentRepository.countByReceiverIdClaimed(userId, claimed)));
    }

    @Transactional
    public Void send(Long userId, SendPresentRequest request) {
        BigDecimal amountToSend = request.getAmount();
        BigDecimal amountToPay = amountToSend.add(PresentConstants.PRESENT_CREATION_COST);

        String description = request.getDescription();
        Long receiverId = request.getReceiverId();
        Boolean anonymous = request.getAnonymous();

        if (Objects.equals(userId, receiverId)) {
            throw new ApiException(ErrorCode.CANT_SELF_SEND);
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        User receiver = userRepository.findById(receiverId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        Wallet wallet = walletService.lock(userId);

        if (wallet.getBalanceCached().compareTo(amountToPay) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }
        walletService.addChange(wallet, amountToPay.negate());

        Present present = new Present();
        present.setClaimed(false);
        present.setTimestamp(Instant.now().getEpochSecond());
        present.setAmount(amountToSend);
        present.setDescription(description != null ? description : "");
        if (!anonymous) present.setSender(user);
        present.setReceiver(receiver);
        presentRepository.save(present);

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

        return new PresentRepresentation(present, profileService.getCardForUser(userId, present.getSender()));
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
