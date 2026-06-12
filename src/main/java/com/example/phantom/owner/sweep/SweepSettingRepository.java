package com.example.phantom.owner.sweep;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface SweepSettingRepository extends JpaRepository<SweepSetting, Long> {
    @Query("SELECT ss FROM SweepSetting ss WHERE ss.id = 0")
    Optional<SweepSetting> find();
}
