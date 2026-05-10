package com.example.phantom.owner.sweep;

import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.exception.TooManyRequestsException;
import com.example.phantom.ratelimit.RateLimitReached;
import com.example.phantom.ratelimit.RateLimiter;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class SweepService {

    private final UserRepository userRepository;
    private final VariableRepository variableRepository;
    private final SweepLogRepository sweepLogRepository;

    private final RateLimiter rateLimiter;
    private Instant lastSweep;

    public SweepService(UserRepository userRepository, VariableRepository variableRepository, SweepLogRepository sweepLogRepository, RateLimiter rateLimiter) {
        this.userRepository = userRepository;
        this.variableRepository = variableRepository;
        this.sweepLogRepository = sweepLogRepository;

        this.rateLimiter = rateLimiter;
        this.lastSweep = Instant.now();
    }

    public List<SweepLogRepresentation> getHistory(Long userId, Integer limit, Long before) {
        User user = getOwner(userId);

        try { rateLimiter.startAction(user, "pagination", Long.valueOf(limit)); }
        catch (RateLimitReached e) { throw new TooManyRequestsException(e.getMessage()); }

        Pageable pageable = PageRequest.of(0, limit);

        List<SweepLog> logs =
                before != null
                        ? sweepLogRepository.findAllBeforePageable(before, pageable)
                        : sweepLogRepository.findAllPageable(pageable);

        return logs.stream().map(SweepLogRepresentation::new).toList();

    }

    public Map<String, String> getSchedule(Long userId) {
        getOwner(userId);

        Variable v = variableRepository.findById("SWEEP_SCHEDULE").orElseThrow(() -> new NotFoundException("sweep schedule does not exist"));

        return Map.of("seconds", v.getValue());
    }

    public Map<String, String> setSchedule(Long userId, SetScheduleRequest request) {
        getOwner(userId);

        Long seconds = request.getSeconds();

        Variable v = new Variable();
        v.setId("SWEEP_SCHEDULE");
        v.setValue(String.valueOf(seconds));
        variableRepository.save(v);

        return Map.of("message", "set");
    }

    public void deleteSchedule(Long userId) {
        getOwner(userId);

        try {
            variableRepository.deleteById("SWEEP_SCHEDULE");
        }
        catch (DataIntegrityViolationException e) {
            throw new NotFoundException("sweep schedule does not exist");
        }
    }

    @Scheduled(fixedDelay = 1000)
    public void sweep() {
        Variable v = variableRepository.findById("SWEEP_SCHEDULE").orElse(null);
        if (v == null) return;

        Instant now = Instant.now();
        if (now.getEpochSecond() - lastSweep.getEpochSecond() < Long.parseLong(v.getValue())) return;

        lastSweep = now;

        SweepLog sweepLog = new SweepLog();
        sweepLog.setTimestamp(now.getEpochSecond());
        sweepLog.setCoin("coin");
        sweepLog.setSender("sender");
        sweepLog.setReceiver("receiver");
        sweepLog.setAmount(BigDecimal.ZERO);
        sweepLog.setStatus("OK");
        sweepLogRepository.save(sweepLog);
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("you don't have permission to use sweep service");
        }
        return user;
    }
}
