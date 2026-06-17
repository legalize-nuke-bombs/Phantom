package com.example.phantom.notification.topic;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "topics")
@Getter
@Setter
@NoArgsConstructor
public class Topic {
    @Id
    private String id;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false)
    private Boolean allowAuthorized;

    @Column(nullable = false)
    private Boolean allowChatModerators;

    @Column(nullable = false)
    private Boolean allowOwners;

    @Column(nullable = false)
    private Boolean allowCustomMembers;
}
