package com.example.phantom.wallet;

import com.example.phantom.exception.*;
import com.example.phantom.money.MoneyConstants;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@Slf4j
public class WalletService {

    private static final BigDecimal USDT_DECIMALS = new BigDecimal(1_000_000);

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final WithdrawalRepository withdrawalRepository;

    private final TronApiClient tronApiClient;
    private final WalletDepositService walletDepositService;
    private final WalletWithdrawalService walletWithdrawalService;
    private final String masterPrivateKey;

    public WalletService(WalletRepository walletRepository,
                         UserRepository userRepository,
                         WithdrawalRepository withdrawalRepository,
                         TronApiClient tronApiClient,
                         WalletDepositService walletDepositService,
                         WalletWithdrawalService walletWithdrawalService,
                         @Qualifier("tronPrivateKey") String masterPrivateKey) {
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;
        this.tronApiClient = tronApiClient;
        this.walletDepositService = walletDepositService;
        this.walletWithdrawalService = walletWithdrawalService;
        this.masterPrivateKey = masterPrivateKey;
    }

    public WalletRepresentation get(Long userId) {
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("wallet not found"));
        return buildWalletRepresentation(wallet);
    }

    public CheckDepositRepresentation checkDeposit(Long userId, String txId) {
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        TxDetails txDetails;
        try {
            txDetails = tronApiClient.getTransactionDetails(txId);
        }
        catch (TronApiException e) {
            log.error("Failed to check deposit, userId={}, txId={}", userId, txId);
            throw new BadRequestException("failed to check deposit");
        }

        if (txDetails.status() == TxDetails.TxStatus.PENDING) {
            return buildCheckDepositRepresentation(wallet, TxDetails.TxStatus.PENDING);
        }
        if (!Objects.equals(txDetails.toAddress(), wallet.getDepositAddress())) {
            log.warn("Deposit address mismatch, userId={}, txId={}, expected={}, got={}", userId, txId, wallet.getDepositAddress(), txDetails.toAddress());
            return buildCheckDepositRepresentation(wallet, TxDetails.TxStatus.FAILED);
        }
        if (txDetails.token() != TxDetails.TxToken.USDT) {
            log.warn("Deposit token mismatch, userId={}, txId={}, token={}", userId, txId, txDetails.token());
            return buildCheckDepositRepresentation(wallet, TxDetails.TxStatus.FAILED);
        }
        if (txDetails.status() != TxDetails.TxStatus.SUCCESS) {
            return buildCheckDepositRepresentation(wallet, txDetails.status());
        }

        wallet = walletDepositService.applyDeposit(wallet.getId(), txDetails);

        return buildCheckDepositRepresentation(wallet, TxDetails.TxStatus.SUCCESS);
    }

    public WalletRepresentation withdrawalInit(Long userId, WithdrawRequest request) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        BigDecimal value = request.getValue();
        String address = request.getAddress();

        Wallet wallet = walletWithdrawalService.reserveMoney(userId, value);

        BigDecimal amountToSend = value.subtract(new BigDecimal(WalletConstants.WITHDRAW_COMMISSION));
        long rawAmount = amountToSend.multiply(USDT_DECIMALS).longValue();

        String txId;
        try {
            txId = tronApiClient.sendUsdt(masterPrivateKey, address, rawAmount);
        }
        catch (TronApiException e) {
            log.error("Withdrawal failed, userId={}, address={}, amount={}", userId, address, rawAmount);
            walletWithdrawalService.refundMoney(userId, value);
            throw new BadRequestException("withdrawal failed");
        }

        Withdrawal withdrawal = new Withdrawal();
        withdrawal.setId(txId);
        withdrawal.setUser(user);
        withdrawal.setValue(value);
        withdrawal.setStatus(TxDetails.TxStatus.PENDING);
        withdrawalRepository.save(withdrawal);

        return buildWalletRepresentation(wallet);
    }

    public WithdrawalCheckRepresentation withdrawalCheck(Long userId) {
        Wallet wallet = walletRepository.findByUserId(userId).orElseThrow(() -> new NotFoundException("wallet not found"));

        List<Withdrawal> withdrawals = withdrawalRepository.findAllByUserId(userId);

        for (Withdrawal withdrawal : withdrawals) {
            try {
                TxDetails txDetails = tronApiClient.getTransactionDetails(withdrawal.getId());
                withdrawal.setStatus(txDetails.status());
            }
            catch (TronApiException e) {
                log.error("Withdrawal check failed, userId={}, txId={}", userId, withdrawal.getId());
            }
        }

        wallet = walletWithdrawalService.withdrawalCheck(wallet.getId(), withdrawals);

        return buildWithdrawalCheckRepresentation(wallet, withdrawals);
    }

    @Scheduled(fixedDelay = 1000 * 60 * 60 * 24)
    public void checkWallets() {
        List<Wallet> wallets = walletRepository.findAll();

        log.info("Wallets={}", wallets.size());

        List<CryptoWalletRepresentation> entries = new ArrayList<>();
        for (Wallet wallet : wallets) {
            if (wallet.getDepositsSum().compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }
            try {
                long usdtBalanceRaw = tronApiClient.getUsdtBalance(wallet.getDepositAddress()).longValue();
                long trxBalanceRaw = tronApiClient.getTrxBalance(wallet.getDepositAddress());
                BigDecimal usdtBalance = new BigDecimal(usdtBalanceRaw).divide(USDT_DECIMALS, MoneyConstants.SCALE, RoundingMode.DOWN);
                BigDecimal trxBalance = new BigDecimal(trxBalanceRaw).divide(USDT_DECIMALS, MoneyConstants.SCALE, RoundingMode.DOWN);
                entries.add(new CryptoWalletRepresentation(wallet.getDepositAddress(), usdtBalance, trxBalance));
            }
            catch (TronApiException e) {
                log.error("Check balance failed, walletAddress={}", wallet.getDepositAddress());
            }
        }
        entries.sort(Comparator.comparing(CryptoWalletRepresentation::token).thenComparing(CryptoWalletRepresentation::nativeToken));

        for (var entry : entries) {
            log.info("USDT={} TRX={} Wallet={}", entry.token(), entry.nativeToken(), entry.address());
        }
    }

    private CheckDepositRepresentation buildCheckDepositRepresentation(Wallet wallet, TxDetails.TxStatus txStatus) {
        CheckDepositRepresentation representation = new CheckDepositRepresentation();
        representation.setWallet(buildWalletRepresentation(wallet));
        representation.setTxStatus(txStatus);
        return representation;
    }

    private WithdrawalCheckRepresentation buildWithdrawalCheckRepresentation(Wallet wallet, List<Withdrawal> withdrawals) {
        List<WithdrawalRepresentation> representations = new ArrayList<>();
        for (Withdrawal w : withdrawals) {
            WithdrawalRepresentation wr = new WithdrawalRepresentation();
            wr.setValue(w.getValue());
            wr.setStatus(w.getStatus());
            representations.add(wr);
        }

        WithdrawalCheckRepresentation representation = new WithdrawalCheckRepresentation();
        representation.setWallet(buildWalletRepresentation(wallet));
        representation.setWithdrawals(representations);
        return representation;
    }

    private WalletRepresentation buildWalletRepresentation(Wallet wallet) {
        WalletRepresentation representation = new WalletRepresentation();
        representation.setId(wallet.getId());
        representation.setBalance(wallet.getBalance());
        representation.setDepositsSum(wallet.getDepositsSum());
        representation.setDepositAddress(wallet.getDepositAddress());
        return representation;
    }
}