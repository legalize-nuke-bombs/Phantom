package com.example.phantom.disk.usage;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "disk_usages", indexes = {
        @Index(name = "idx_disk_usages_user_id", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
public class DiskUsage {
    @Id
    @Column(name = "user_id")
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false)
    private Long size;

    @Column(nullable = false)
    private Long files;

    @Column(nullable = false)
    private Long favourites;
}
