package com.example.phantom.lottery;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.experience.ExperienceService;
import com.example.phantom.experience.experiencechange.ExperienceChange;
import com.example.phantom.experience.experiencechange.ExperienceChangeType;
import com.example.phantom.profile.ProfileCardRepresentation;
import com.example.phantom.profile.ProfileService;
import com.example.phantom.provablyfair.ProvablyFairProvider;
import com.example.phantom.usagelimit.UsageAction;
import com.example.phantom.usagelimit.UsageLimitReached;
import com.example.phantom.usagelimit.UsageLimiter;
import com.example.phantom.user.PrivacySetting;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.Wallet;
import com.example.phantom.wallet.WalletService;
import com.example.phantom.wallet.balancechange.BalanceChangeType;
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
public class LotteryService {

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final ExperienceService experienceService;
    private final LotteryRepository lotteryRepository;
    private final LotteryBetRepository lotteryBetRepository;
    private final LotterySettings lotterySettings;
    private final UsageLimiter usageLimiter;
    private final ProfileService profileService;
    private final ProvablyFairProvider provablyFairProvider;

    public LotteryService(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, LotteryRepository lotteryRepository, LotteryBetRepository lotteryBetRepository, LotterySettings lotterySettings, UsageLimiter usageLimiter, ProfileService profileService, ProvablyFairProvider provablyFairProvider) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.lotteryRepository = lotteryRepository;
        this.lotteryBetRepository = lotteryBetRepository;
        this.lotterySettings = lotterySettings;
        this.usageLimiter = usageLimiter;
        this.profileService = profileService;
        this.provablyFairProvider = provablyFairProvider;
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

                provablyFairProvider.generateHash(lottery.getSeed()),

                ticketCost,

                ticketsAmountPersonal,
                ticketsAmountTotal,

                ticketCost.multiply(new BigDecimal(ticketsAmountPersonal)),
                ticketCost.multiply(new BigDecimal(ticketsAmountTotal))
        );
    }

    public List<FinishedLotteryRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getUser(userId);

        try { usageLimiter.startAction(user, UsageAction.PAGINATION, Long.valueOf(limit)); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<Lottery> lotteries = before != null
                ? lotteryRepository.findFinishedWithWinnersBefore(before, pageable)
                : lotteryRepository.findFinishedWithWinners(pageable);

        List<User> winners = lotteries.stream()
                .map(Lottery::getWinner)
                .filter(Objects::nonNull)
                .filter(winner -> winner.getLotteryPrivacySetting() == PrivacySetting.EVERYONE)
                .toList();
        Map<Long, ProfileCardRepresentation> winnerCards = profileService.getCardsForUsers(userId, winners);

        List<FinishedLotteryRepresentation> lotteryRepresentations = new ArrayList<>();
        for (Lottery lottery : lotteries) {
            lotteryRepresentations.add(new FinishedLotteryRepresentation(
                    lottery.getId(),
                    lottery.getTimestamp(),
                    lottery.getSeed(),
                    lottery.getWinner() != null ? winnerCards.get(lottery.getWinner().getId()) : null,
                    lottery.getPrize(),
                    lottery.getTicketsAmountTotal()
            ));
        }
        return lotteryRepresentations;
    }

    @Transactional
    public Map<String, String> buyTickets(Long userId, LotteryTicketAmountRequest request) {
        User user = getUser(userId);

        try { usageLimiter.startAction(user, UsageAction.LOTTERY, 1L); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Wallet wallet = walletService.lock(userId);

        Long ticketsAmount = request.getAmount();
        BigDecimal ticketsCost = lotterySettings.getTicketCost().multiply(new BigDecimal(ticketsAmount));

        if (wallet.getBalanceCached().compareTo(ticketsCost) < 0) {
            throw new BadRequestException("insufficient balance");
        }

        Lottery lottery = getCurrentLottery();

        if (Instant.now().getEpochSecond() >= lottery.getTimestamp() + lotterySettings.getBlock()) {
            throw new BadRequestException("lottery does not sell tickets anymore");
        }

        walletService.addChange(user, wallet, ticketsCost.negate(), BalanceChangeType.LOTTERY_TICKET_BUY, String.valueOf(ticketsAmount));

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

        try { usageLimiter.startAction(user, UsageAction.LOTTERY, 1L); }
        catch (UsageLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Wallet wallet = walletService.lock(userId);

        Long ticketsAmount = request.getAmount();
        BigDecimal ticketsCost = lotterySettings.getTicketCost().multiply(new BigDecimal(ticketsAmount));

        Lottery lottery = getCurrentLottery();

        if (Instant.now().getEpochSecond() >= lottery.getTimestamp() + lotterySettings.getBlock()) {
            throw new BadRequestException("lottery does not refund tickets anymore");
        }

        LotteryBet lotteryBet = lotteryBetRepository.findByLotteryIdAndUserIdForPessimisticWrite(lottery.getId(), user.getId())
                .orElseThrow(() -> new BadRequestException("you have not bought any tickets"));

        if (lotteryBet.getTickets() < ticketsAmount) {
            throw new BadRequestException("you don't have enough tickets");
        }

        walletService.addChange(user, wallet, ticketsCost, BalanceChangeType.LOTTERY_TICKET_REFUND, String.valueOf(ticketsAmount));

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

        BigDecimal ticketCost = lotterySettings.getTicketCost();

        List<LotteryBet> bets = lotteryBetRepository.findAllByLotteryId(lottery.getId());

        long ticketsAmountTotal = bets.stream().mapToLong(LotteryBet::getTickets).sum();
        if (ticketsAmountTotal == 0) {
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
        }
        experienceService.addChanges(experienceChanges);

        Random random = provablyFairProvider.fairRandomSingle(lottery.getSeed());

        Long happyTicket = random.nextLong(ticketsAmountTotal);

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
        walletService.addChange(winner, winnerWallet, prize, BalanceChangeType.LOTTERY_WIN, "");

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
        lottery.setSeed(provablyFairProvider.generateSeed());
        lotteryRepository.save(lottery);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
    }

    private Lottery getCurrentLottery() {
        return lotteryRepository.findCurrent().orElseThrow(() -> new NotFoundException("current lottery does not exist yet"));
    }
}
