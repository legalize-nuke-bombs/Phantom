package com.example.phantom.ref;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "ref_members", indexes = {
        @Index(name = "idx_ref_members_ref_storage_id", columnList = "ref_storage_id")
}
)
@Getter
@Setter
@NoArgsConstructor
public class RefMember {
    @Id
    @Column(name = "user_id")
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne
    @JoinColumn(name = "ref_storage_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private RefStorage refStorage;
}
