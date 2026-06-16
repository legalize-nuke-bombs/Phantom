package com.example.phantom.game;

import com.example.phantom.experience.ExperienceService;
import com.example.phantom.provablyfair.ProvablyFairService;
import com.example.phantom.ref.RefService;
import com.example.phantom.user.UserRepository;
import com.example.phantom.wallet.WalletService;
import org.springframework.stereotype.Component;

@Component
public class GameDependencies {
    final UserRepository userRepository;
    final WalletService walletService;
    final ExperienceService experienceService;
    final RefService refService;
    final ProvablyFairService provablyFairService;
    final GameRepository gameRepository;

    public GameDependencies(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, RefService refService, ProvablyFairService provablyFairService, GameRepository gameRepository) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.refService = refService;
        this.provablyFairService = provablyFairService;
        this.gameRepository = gameRepository;
    }
}
