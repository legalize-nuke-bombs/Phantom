package com.example.phantom.ref;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface RefMemberRepository extends JpaRepository<RefMember, Long> {
    @Query("SELECT rm FROM RefMember rm JOIN FETCH rm.user WHERE rm.refStorage.id = ?1 AND (?2 IS NULL OR rm.id < ?2) ORDER BY rm.id DESC")
    List<RefMember> findByRefStorageIdWithUsers(Long refStorageId, Long before, Pageable pageable);
}
