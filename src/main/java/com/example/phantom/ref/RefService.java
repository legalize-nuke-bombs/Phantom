package com.example.phantom.ref;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
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
    private final RateLimitService rateLimitService;

    public RefService(UserRepository userRepository, RefStorageRepository refStorageRepository, RefMemberRepository refMemberRepository, WalletService walletService, RateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.refStorageRepository = refStorageRepository;
        this.refMemberRepository = refMemberRepository;
        this.walletService = walletService;
        this.rateLimitService = rateLimitService;
    }

    public List<UserShortRepresentation> getRefMembers(Long userId, Integer limit, Long before) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
        RefStorage rs = refStorageRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.REF_STORAGE_NOT_FOUND));

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<RefMember> refMembers = refMemberRepository.findByRefStorageIdWithUsers(rs.getId(), before, pageable);
        List<User> users = refMembers.stream().map(RefMember::getUser).toList();

        return users.stream().filter(java.util.Objects::nonNull).map(UserShortRepresentation::new).toList();
    }

    public RefStorageRepresentation getRefStorage(Long userId) {
        RefStorage rs = refStorageRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.REF_STORAGE_NOT_FOUND));

        return new RefStorageRepresentation(rs);
    }

    @Transactional
    public void registerBet(User user, BigDecimal amount) {
        RefStorage rs = refStorageRepository.findByMemberIdForPessimisticWrite(user.getId()).orElse(null);
        if (rs == null) {
            return;
        }

        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(ErrorCode.INVALID_AMOUNT);
        }

        BigDecimal toAdd = amount.multiply(RefConstants.REF_EDGE);

        rs.setAmount(rs.getAmount().add(toAdd));
        rs.setTotal(rs.getTotal().add(toAdd));

        refStorageRepository.save(rs);
    }

    @Transactional
    public RefStorageRepresentation claim(Long userId) {
        RefStorage rs = refStorageRepository.findByIdForPessimisticWrite(userId).orElseThrow(() -> new ApiException(ErrorCode.REF_STORAGE_NOT_FOUND));
        Wallet wallet = walletService.lock(userId);

        walletService.addChange(wallet, rs.getAmount());

        rs.setAmount(BigDecimal.ZERO);
        refStorageRepository.save(rs);

        return new RefStorageRepresentation(rs);
    }
}
