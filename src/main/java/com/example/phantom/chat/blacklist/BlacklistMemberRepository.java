package com.example.phantom.chat.blacklist;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BlacklistMemberRepository extends JpaRepository<BlacklistMember, Long> {
}
