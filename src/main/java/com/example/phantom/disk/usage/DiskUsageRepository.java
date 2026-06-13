package com.example.phantom.disk.usage;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface DiskUsageRepository extends JpaRepository<DiskUsage, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT du FROM DiskUsage du WHERE du.user.id = ?1")
    Optional<DiskUsage> findByIdForPessimisticWrite(Long userId);

    @Query("SELECT COALESCE(SUM(du.size), 0) FROM DiskUsage du")
    long sumSizes();

    @Query("SELECT COALESCE(SUM(du.files), 0) FROM DiskUsage du")
    long sumFiles();
}
