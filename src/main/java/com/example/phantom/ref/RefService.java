package com.example.phantom.ref;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class RefService {

    private final UserRepository userRepository;
    private final RefStorageRepository refStorageRepository;
    private final RefMemberRepository refMemberRepository;
    private final WalletService walletService;
    private final ProfileService profileService;
    private final UsageLimiter usageLimiter;

    public RefService(UserRepository userRepository, RefStorageRepository refStorageRepository, RefMemberRepository refMemberRepository, WalletService walletService, ProfileService profileService, UsageLimiter usageLimiter) {
        this.userRepository = userRepository;
        this.refStorageRepository = refStorageRepository;
        this.refMemberRepository = refMemberRepository;
        this.walletService = walletService;
        this.profileService = profileService;
        this.usageLimiter = usageLimiter;
    }

    public List<ProfileCardRepresentation> getRefMembers(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        RefStorage rs = refStorageRepository.findById(userId).orElseThrow(() -> new NotFoundException("ref storage not found"));

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, limit.longValue()); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<RefMember> refMembers = refMemberRepository.findByRefStorageIdWithUsers(rs.getId(), before, pageable);
        List<User> users = refMembers.stream().map(RefMember::getUser).toList();

        return profileService.getCardsForUsers(userId, users).values().stream().toList();
    }

    public RefStorageRepresentation getRefStorage(Long userId) {
        RefStorage rs = refStorageRepository.findById(userId).orElseThrow(() -> new NotFoundException("ref storage not found"));

        return new RefStorageRepresentation(rs);
    }

    @Transactional
    public void registerBet(User user, BigDecimal amount) {
        RefStorage rs = refStorageRepository.findByMemberIdForPessimisticWrite(user.getId()).orElse(null);
        if (rs == null) {
            return;
        }

        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("amount is negative");
        }

        BigDecimal toAdd = amount.multiply(RefConstants.REF_EDGE);

        rs.setAmount(rs.getAmount().add(toAdd));
        rs.setTotal(rs.getTotal().add(toAdd));

        refStorageRepository.save(rs);
    }

    @Transactional
    public RefStorageRepresentation claim(Long userId) {
        RefStorage rs = refStorageRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new NotFoundException("ref storage not found"));
        Wallet wallet = walletService.lock(userId);

        walletService.addChange(wallet, rs.getAmount());

        rs.setAmount(BigDecimal.ZERO);
        refStorageRepository.save(rs);

        return new RefStorageRepresentation(rs);
    }
}
