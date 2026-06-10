package com.example.phantom.ref;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RefMemberRepository extends JpaRepository<RefMember, Long> {
    @Query("SELECT rm FROM RefMember rm JOIN FETCH rm.user WHERE rm.refStorage.id = ?1 AND (?2 IS NULL OR rm.id < ?2) ORDER BY rm.id DESC")
    List<RefMember> findByRefStorageIdWithUsers(Long refStorageId, Long before, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rm.refStorage FROM RefMember rm WHERE rm.user.id = ?1")
    Optional<RefStorage> findRefStorageByUserIdForPessimisticWrite(Long userId);
}
