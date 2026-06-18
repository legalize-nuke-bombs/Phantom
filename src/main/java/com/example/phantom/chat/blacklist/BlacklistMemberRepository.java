package com.example.phantom.chat.blacklist;

import com.example.phantom.user.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface BlacklistMemberRepository extends JpaRepository<BlacklistMember, Long> {
    @Query("SELECT bm.user FROM BlacklistMember bm WHERE bm.blacklist.id = ?1 AND (?2 IS NULL OR bm.user.id < ?2) ORDER BY bm.user.id DESC")
    List<User> findUsersById(Long blacklistId, Long before, Pageable pageable);

    @Modifying
    @Query("DELETE BlacklistMember bm WHERE bm.blacklist.id = ?1 AND bm.user.id = ?2")
    void deleteByBlacklistIdUserId(Long blacklistId, Long userId);

    @Query("SELECT bm FROM BlacklistMemberm bm WHERE bm.blacklist.id = ?1 AND bm.user.id = ?2")
    Optional<Blacklist> findByBlacklistIdUserId(Long blacklistId, Long userId);
}
