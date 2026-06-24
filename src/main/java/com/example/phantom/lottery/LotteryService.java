package com.example.phantom.lottery;

import com.example.phantom.exception.ApiException;
import com.example.phantom.exception.ErrorCode;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.notification.NotificationPublishService;
import com.example.phantom.notification.NotificationType;
import com.example.phantom.topic.globaltopic.GlobalTopicService;
import com.example.phantom.provablyfair.ProvablyFairService;
import com.example.phantom.ref.RefService;
import com.example.phantom.ratelimit.RateLimitAction;
import com.example.phantom.ratelimit.RateLimitService;
import com.example.phantom.user.PrivacySettingService;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.user.UserShortRepresentation;
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
    private final LotteryCreatorService lotteryCreatorService;
    private final RateLimitService rateLimitService;
    private final ProvablyFairService provablyFairService;
    private final PrivacySettingService privacySettingService;
    private final NotificationPublishService notificationPublishService;
    private final GlobalTopicService globalTopicService;

    public LotteryService(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, RefService refService, LotteryRepository lotteryRepository, LotteryBetRepository lotteryBetRepository, LotteryCreatorService lotteryCreatorService, RateLimitService rateLimitService, ProvablyFairService provablyFairService, PrivacySettingService privacySettingService, NotificationPublishService notificationPublishService, GlobalTopicService globalTopicService) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.refService = refService;
        this.lotteryRepository = lotteryRepository;
        this.lotteryBetRepository = lotteryBetRepository;
        this.lotteryCreatorService = lotteryCreatorService;
        this.rateLimitService = rateLimitService;
        this.provablyFairService = provablyFairService;
        this.privacySettingService = privacySettingService;
        this.notificationPublishService = notificationPublishService;
        this.globalTopicService = globalTopicService;
    }

    public CurrentLotteryRepresentation getCurrent(Long userId) {
        Lottery lottery = getCurrentLottery();

        Long ticketsAmountPersonal = lotteryBetRepository.sumByLotteryIdAndUserId(lottery.getId(), userId);
        Long ticketsAmountTotal = lotteryBetRepository.sumByLotteryId(lottery.getId());

        return new CurrentLotteryRepresentation(
                lottery.getId(),

                lottery.getTimestamp(),
                lottery.getTimestampBlock(),
                lottery.getTimestampEnd(),

                provablyFairService.generateHash(lottery.getSeed1()),
                provablyFairService.generateHash(lottery.getSeed2()),

                lottery.getTicketCost(),

                ticketsAmountPersonal,
                ticketsAmountTotal,

                lottery.getTicketCost().multiply(new BigDecimal(ticketsAmountPersonal)),
                lottery.getTicketCost().multiply(new BigDecimal(ticketsAmountTotal))
        );
    }

    public List<FinishedLotteryRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<Lottery> lotteries = lotteryRepository.findFinishedWithWinners(before, pageable);

        List<User> winners = lotteries.stream()
                .map(Lottery::getWinner)
                .filter(Objects::nonNull)
                .filter(u -> privacySettingService.isVisible(user.getId(), u.getId(), u.getLotteryPrivacySetting()))
                .toList();
        Map<Long, UserShortRepresentation> winnerMap = winners.stream().filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toMap(User::getId, UserShortRepresentation::new, (a, b) -> a));

        List<FinishedLotteryRepresentation> lotteryRepresentations = new ArrayList<>();
        for (Lottery lottery : lotteries) {
            lotteryRepresentations.add(new FinishedLotteryRepresentation(
                    lottery.getId(),
                    lottery.getTimestamp(),
                    lottery.getSeed1(),
                    lottery.getSeed2(),
                    lottery.getWinner() != null ? winnerMap.get(lottery.getWinner().getId()) : null,
                    lottery.getHappyTicket(),
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

        rateLimitService.startAction(user.getId(), RateLimitAction.PAGINATION, limit);

        Pageable pageable = PageRequest.of(0, limit);

        List<LotteryBet> bets = lotteryBetRepository.findAllByLotteryIdWithUsers(id, beforeTickets, beforeId, pageable);

        List<User> users = bets.stream()
                .map(LotteryBet::getUser)
                .filter(Objects::nonNull)
                .filter(u -> privacySettingService.isVisible(user.getId(), u.getId(), u.getLotteryPrivacySetting()))
                .toList();

        Map<Long, UserShortRepresentation> usersById = users.stream().filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toMap(User::getId, UserShortRepresentation::new, (a, b) -> a));

        List<LotteryBetRepresentation> betRepresentations = new ArrayList<>();
        for (LotteryBet bet : bets) {
            betRepresentations.add(new LotteryBetRepresentation(bet, bet.getUser() != null ? usersById.get(bet.getUser().getId()) : null));
        }
        return betRepresentations;
    }

    @Transactional
    public Map<String, String> buyTickets(Long userId, LotteryTicketAmountRequest request) {
        User user = getUser(userId);

        rateLimitService.startAction(user.getId(), RateLimitAction.LOTTERY, 1L);

        Lottery lottery = getCurrentLottery();
        Wallet wallet = walletService.lock(userId);

        Long ticketsAmount = request.getAmount();
        BigDecimal ticketsCost = lottery.getTicketCost().multiply(new BigDecimal(ticketsAmount));

        if (wallet.getBalanceCached().compareTo(ticketsCost) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }

        if (Instant.now().getEpochSecond() >= lottery.getTimestampBlock()) {
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

        rateLimitService.startAction(user.getId(), RateLimitAction.LOTTERY, 1L);

        Wallet wallet = walletService.lock(userId);
        Lottery lottery = getCurrentLottery();

        Long ticketsAmount = request.getAmount();
        BigDecimal ticketsCost = lottery.getTicketCost().multiply(new BigDecimal(ticketsAmount));

        if (Instant.now().getEpochSecond() >= lottery.getTimestampBlock()) {
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

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void checkCurrentLottery() {
        Long now = Instant.now().getEpochSecond();

        Lottery lottery = lotteryRepository.findCurrent().orElse(null);
        if (lottery == null) {
            lottery = lotteryCreatorService.createNewLottery();
        }

        if (lottery.getTimestampNotificationEnding() != null &&
                lottery.getNotificationEndingFired() != null &&
                now >= lottery.getTimestampNotificationEnding() &&
                !lottery.getNotificationEndingFired()) {
            log.info("firing notification ending...");
            lottery.setNotificationEndingFired(true);
            lotteryRepository.save(lottery);
            notificationPublishService.createTopicNotification(globalTopicService.findAuthorized(), NotificationType.LOTTERY_IS_ENDING, null);
        }

        if (lottery.getTimestampEnd() > now) {
            return;
        }

        log.info("starting lottery...");

        BigDecimal ticketCost = lottery.getTicketCost();

        List<LotteryBet> bets = lotteryBetRepository.findAllByLotteryIdWithUsers(lottery.getId());

        long ticketsAmountTotal = bets.stream().mapToLong(LotteryBet::getTickets).sum();
        log.info("tickets bought: {}", ticketsAmountTotal);
        if (ticketsAmountTotal == 0) {
            log.info("no tickets bought");
            lotteryRepository.delete(lottery);
            lotteryCreatorService.createNewLottery();
            return;
        }

        log.info("granting rewards for bets...");
        for (LotteryBet bet : bets) {
            if (bet.getUser() == null) {
                continue;
            }
            experienceService.addChange(bet.getUser(), ticketCost.multiply(BigDecimal.valueOf(bet.getTickets())).multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.DOWN).longValue(), ExperienceChangeType.LOTTERY_TICKET, "Tickets: " + bet.getTickets());
            refService.registerBet(bet.getUser(), ticketCost.multiply(BigDecimal.valueOf(bet.getTickets())));
        }
        log.info("rewards for bets granted");

        Random random = provablyFairService.fairRandom(lottery.getSeed1(), lottery.getSeed2());

        Long happyTicket = random.nextLong(ticketsAmountTotal);
        lottery.setHappyTicket(happyTicket);

        User winner = null;
        for (LotteryBet bet : bets) {
            if (bet.getTickets() > happyTicket) {
                winner = bet.getUser();
                break;
            }
            happyTicket -= bet.getTickets();
        }

        BigDecimal prize = ticketCost.multiply(new BigDecimal(ticketsAmountTotal)).multiply(new BigDecimal("0.95"));

        log.info("happy ticket: {}", happyTicket);
        log.info("prize: {}", prize);
        log.info("winner: {}", winner != null ? winner.getId() : null);

        lottery.setWinner(winner);
        lottery.setPrize(prize);
        lottery.setTicketsAmountTotal(ticketsAmountTotal);
        lotteryRepository.save(lottery);

        log.info("firing notification ended...");
        notificationPublishService.createTopicNotification(globalTopicService.findAuthorized(), NotificationType.LOTTERY_ENDED, null);

        if (winner != null) {
            log.info("granting the winner...");
            Wallet winnerWallet = walletService.lock(winner.getId());
            walletService.addChange(winnerWallet, prize);
            notificationPublishService.createUserNotification(winner, NotificationType.YOU_WON_LOTTERY, null);
        }

        lotteryCreatorService.createNewLottery();
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.NOT_AUTHENTICATED));
    }

    private Lottery getCurrentLottery() {
        return lotteryRepository.findCurrent().orElseThrow(() -> new ApiException(ErrorCode.LOTTERY_NOT_FOUND));
    }
}
