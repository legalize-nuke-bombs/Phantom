package com.example.phantom.lottery;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.experience.experiencechange.ExperienceChange;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.provablyfair.ProvablyFairService;
import com.example.phantom.ref.RefService;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitService;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
public class LotteryService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final ExperienceService experienceService;
    private final RefService refService;
    private final LotteryRepository lotteryRepository;
    private final LotteryBetRepository lotteryBetRepository;
    private final LotterySettings lotterySettings;
    private final UsageLimitService usageLimitService;
    private final ProfileService profileService;
    private final ProvablyFairService provablyFairService;
    private final PrivacySettingService privacySettingService;

    public LotteryService(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, RefService refService, LotteryRepository lotteryRepository, LotteryBetRepository lotteryBetRepository, LotterySettings lotterySettings, UsageLimitService usageLimitService, ProfileService profileService, ProvablyFairService provablyFairService, PrivacySettingService privacySettingService) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.refService = refService;
        this.lotteryRepository = lotteryRepository;
        this.lotteryBetRepository = lotteryBetRepository;
        this.lotterySettings = lotterySettings;
        this.usageLimitService = usageLimitService;
        this.profileService = profileService;
        this.provablyFairService = provablyFairService;
        this.privacySettingService = privacySettingService;
    }

    public CurrentLotteryRepresentation getCurrent(Long userId) {
        Lottery lottery = getCurrentLottery();

        BigDecimal ticketCost = lotterySettings.getTicketCost();

        Long ticketsAmountPersonal = lotteryBetRepository.sumByLotteryIdAndUserId(lottery.getId(), userId);
        Long ticketsAmountTotal = lotteryBetRepository.sumByLotteryId(lottery.getId());

        return new CurrentLotteryRepresentation(
                lottery.getId(),

                lottery.getTimestamp(),
                lottery.getTimestamp() + lotterySettings.getBlock(),
                lottery.getTimestamp() + lotterySettings.getEnd(),

                provablyFairService.generateHash(lottery.getSeed1()),
                provablyFairService.generateHash(lottery.getSeed2()),

                ticketCost,

                ticketsAmountPersonal,
                ticketsAmountTotal,

                ticketCost.multiply(new BigDecimal(ticketsAmountPersonal)),
                ticketCost.multiply(new BigDecimal(ticketsAmountTotal))
        );
    }

    public List<FinishedLotteryRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Lottery> lotteries = lotteryRepository.findFinishedWithWinners(before, pageable);

        List<User> winners = lotteries.stream()
                .map(Lottery::getWinner)
                .filter(Objects::nonNull)
                .filter(u -> privacySettingService.isVisible(user.getId(), u.getId(), u.getLotteryPrivacySetting()))
                .toList();
        Map<Long, ProfileCardRepresentation> winnerCards = profileService.getCardsForUsers(userId, winners);

        List<FinishedLotteryRepresentation> lotteryRepresentations = new ArrayList<>();
        for (Lottery lottery : lotteries) {
            lotteryRepresentations.add(new FinishedLotteryRepresentation(
                    lottery.getId(),
                    lottery.getTimestamp(),
                    lottery.getSeed1(),
                    lottery.getSeed2(),
                    lottery.getWinner() != null ? winnerCards.get(lottery.getWinner().getId()) : null,
                    lottery.getPrize(),
                    lottery.getTicketsAmountTotal()
            ));
        }
        return lotteryRepresentations;
    }

    public List<LotteryBetRepresentation> getBets(Long userId, Long id, Integer limit, Long beforeTickets, Long beforeId) {
        if ((beforeTickets == null) != (beforeId == null)) {
            throw new ApiException(ErrorCode.INVALID_CURSOR);
        }

        User user = getUser(userId);

        usageLimitService.startAction(user, UsageAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<LotteryBet> bets = lotteryBetRepository.findAllByLotteryIdWithUsers(id, beforeTickets, beforeId, pageable);

        List<User> users = bets.stream()
                .map(LotteryBet::getUser)
                .filter(u -> privacySettingService.isVisible(user.getId(), u.getId(), u.getLotteryPrivacySetting()))
                .toList();

        Map<Long, ProfileCardRepresentation> profileCards = profileService.getCardsForUsers(user.getId(), users);

        List<LotteryBetRepresentation> betRepresentations = new ArrayList<>();
        for (LotteryBet bet : bets) {
            betRepresentations.add(new LotteryBetRepresentation(bet, profileCards.get(bet.getUser().getId())));
        }
        return betRepresentations;
    }

    @Transactional
    public Map<String, String> buyTickets(Long userId, LotteryTicketAmountRequest request) {
        User user = getUser(userId);

        usageLimitService.startAction(user, UsageAction.LOTTERY, 1L);

        Wallet wallet = walletService.lock(userId);

        Long ticketsAmount = request.getAmount();
        BigDecimal ticketsCost = lotterySettings.getTicketCost().multiply(new BigDecimal(ticketsAmount));

        if (wallet.getBalanceCached().compareTo(ticketsCost) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        Lottery lottery = getCurrentLottery();

        if (Instant.now().getEpochSecond() >= lottery.getTimestamp() + lotterySettings.getBlock()) {
            throw new ApiException(ErrorCode.LOTTERY_SALES_CLOSED);
        }

        walletService.addChange(wallet, ticketsCost.negate());

        LotteryBet lotteryBet = lotteryBetRepository.findByLotteryIdAndUserIdForPessimisticWrite(lottery.getId(), user.getId()).orElse(null);
        if (lotteryBet == null) {
            lotteryBet = new LotteryBet();
            lotteryBet.setLottery(lottery);
            lotteryBet.setUser(user);
            lotteryBet.setTickets(0L);
        }

        lotteryBet.setTickets(lotteryBet.getTickets() + ticketsAmount);
        lotteryBetRepository.save(lotteryBet);

        return Map.of("message", "bought");
    }

    @Transactional
    public Map<String, String> refundTickets(Long userId, LotteryTicketAmountRequest request) {
        User user = getUser(userId);

        usageLimitService.startAction(user, UsageAction.LOTTERY, 1L);

        Wallet wallet = walletService.lock(userId);

        Long ticketsAmount = request.getAmount();
        BigDecimal ticketsCost = lotterySettings.getTicketCost().multiply(new BigDecimal(ticketsAmount));

        Lottery lottery = getCurrentLottery();

        if (Instant.now().getEpochSecond() >= lottery.getTimestamp() + lotterySettings.getBlock()) {
            throw new ApiException(ErrorCode.LOTTERY_REFUND_CLOSED);
        }

        LotteryBet lotteryBet = lotteryBetRepository.findByLotteryIdAndUserIdForPessimisticWrite(lottery.getId(), user.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_ENOUGH_TICKETS));

        if (lotteryBet.getTickets() < ticketsAmount) {
            throw new ApiException(ErrorCode.NOT_ENOUGH_TICKETS);
        }

        walletService.addChange(wallet, ticketsCost);

        lotteryBet.setTickets(lotteryBet.getTickets() - ticketsAmount);
        lotteryBetRepository.save(lotteryBet);

        return Map.of("message", "refunded");
    }

    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void checkCurrentLottery() {
        Lottery lottery = getCurrentLottery();

        if (lottery.getTimestamp() + lotterySettings.getEnd() > Instant.now().getEpochSecond()) {
            return;
        }

        log.info("starting lottery...");

        BigDecimal ticketCost = lotterySettings.getTicketCost();

        List<LotteryBet> bets = lotteryBetRepository.findAllByLotteryIdWithUsers(lottery.getId());

        long ticketsAmountTotal = bets.stream().mapToLong(LotteryBet::getTickets).sum();
        log.info("tickets bought: {}", ticketsAmountTotal);
        if (ticketsAmountTotal == 0) {
            log.info("no tickets bought");
            lotteryRepository.delete(lottery);
            createNewLottery();
            return;
        }

        List<ExperienceChange> experienceChanges = new ArrayList<>();
        for (LotteryBet bet : bets) {
            ExperienceChange experienceChange = new ExperienceChange();
            experienceChange.setUser(bet.getUser());
            experienceChange.setAmount(ticketCost.multiply(BigDecimal.valueOf(bet.getTickets()))
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(0, RoundingMode.DOWN).longValue()
            );
            experienceChange.setTimestamp(Instant.now().getEpochSecond());
            experienceChange.setType(ExperienceChangeType.LOTTERY_TICKET);
            experienceChange.setDetails(String.valueOf(bet.getTickets()));
            experienceChanges.add(experienceChange);
        }
        experienceService.addChanges(experienceChanges);

        for (LotteryBet bet : bets) {
            refService.registerBet(bet.getUser(), ticketCost.multiply(BigDecimal.valueOf(bet.getTickets())));
        }

        Random random = provablyFairService.fairRandom(lottery.getSeed1(), lottery.getSeed2());

        Long happyTicket = random.nextLong(ticketsAmountTotal);
        log.info("happy ticket: {}", happyTicket);

        User winner = null;
        for (LotteryBet bet : bets) {
            if (bet.getTickets() > happyTicket) {
                winner = bet.getUser();
                break;
            }
            happyTicket -= bet.getTickets();
        }

        if (winner == null) {
            throw new RuntimeException("unexpected error happened");
        }

        BigDecimal prize = ticketCost.multiply(new BigDecimal(ticketsAmountTotal)).multiply(new BigDecimal("0.95"));

        lottery.setWinner(winner);
        lottery.setPrize(prize);
        lottery.setTicketsAmountTotal(ticketsAmountTotal);
        lotteryRepository.save(lottery);

        Wallet winnerWallet = walletService.lock(winner.getId());
        walletService.addChange(winnerWallet, prize);

        createNewLottery();
    }

    @Transactional
    public void ensureLotteryExists() {
        if (lotteryRepository.findCurrent().isEmpty()) {
            createNewLottery();
        }
    }

    private void createNewLottery() {
        Lottery lottery = new Lottery();
        lottery.setTimestamp(Instant.now().getEpochSecond());
        lottery.setSeed1(provablyFairService.generateSeed());
        lottery.setSeed2(provablyFairService.generateSeed());
        lotteryRepository.save(lottery);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private Lottery getCurrentLottery() {
        return lotteryRepository.findCurrent().orElseThrow(() -> new ApiException(ErrorCode.LOTTERY_NOT_FOUND));
    }
}
