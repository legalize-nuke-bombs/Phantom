package com.example.phantom.ref;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface RefStorageRepository extends JpaRepository<RefStorage, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rs FROM RefStorage rs WHERE rs.id = ?1")
    Optional<RefStorage> findByIdForPessimisticWrite(Long rsId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rs FROM RefStorage rs WHERE rs.id = (SELECT rm.refStorage.id FROM RefMember rm WHERE rm.user.id = ?1)")
    Optional<RefStorage> findByMemberIdForPessimisticWrite(Long userId);
}
