package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CoinType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface MasterWalletSettingRepository extends JpaRepository<MasterWalletSetting, Long> {
    @Query("SELECT mws FROM MasterWalletSetting mws WHERE mws.coin = ?1")
    Optional<MasterWalletSetting> findByCoinType(CoinType coin);
}
