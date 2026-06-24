package com.example.phantom.topic;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "topics", indexes = {
        @Index(name = "idx_topics_allowAuthorized", columnList = "allowAuthorized"),
        @Index(name = "idx_topics_allowChatModerators", columnList = "allowChatModerators"),
        @Index(name = "idx_topics_allowOwners", columnList = "allowOwners"),
        @Index(name = "idx_topics_allowCustomMembers", columnList = "allowCustomMembers")
})
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
