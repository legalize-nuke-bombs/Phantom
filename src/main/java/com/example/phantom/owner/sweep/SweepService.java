package com.example.phantom.owner.sweep;

import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.Map;

@Service
@Slf4j
public class SweepService {

    private final UserRepository userRepository;
    private final VariableRepository variableRepository;
    private Instant lastSweep;

    public SweepService(UserRepository userRepository, VariableRepository variableRepository) {
        this.userRepository = userRepository;
        this.variableRepository = variableRepository;
        this.lastSweep = Instant.now();
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

        log.info("sweep");
    }

    private User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("not an owner");
        }
        return user;
    }
}
