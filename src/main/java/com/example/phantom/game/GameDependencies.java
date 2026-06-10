package com.example.phantom.game;

import com.example.phantom.experience.ExperienceService;
import com.example.phantom.profile.ProfileService;
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
    final ProfileService profileService;
    final RefService refService;
    final ProvablyFairService provablyFairService;
    final GameRepository gameRepository;

    public GameDependencies(UserRepository userRepository, WalletService walletService, ExperienceService experienceService, ProfileService profileService, RefService refService, ProvablyFairService provablyFairService, GameRepository gameRepository) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.experienceService = experienceService;
        this.profileService = profileService;
        this.refService = refService;
        this.provablyFairService = provablyFairService;
        this.gameRepository = gameRepository;
    }
}
