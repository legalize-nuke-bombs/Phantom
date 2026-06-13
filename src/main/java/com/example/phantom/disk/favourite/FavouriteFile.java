package com.example.phantom.disk.favourite;

import com.example.phantom.disk.File;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "favourite_files", indexes = {
        @Index(name = "idx_favourite_files_user_id_timestamp", columnList = "user_id, timestamp")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "file_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class FavouriteFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long timestamp;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne
    @JoinColumn(name = "file_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private File file;
}
