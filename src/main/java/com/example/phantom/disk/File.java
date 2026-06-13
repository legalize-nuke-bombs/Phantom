package com.example.phantom.disk;

import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.util.UUID;

@Entity
@Table(name = "files", indexes = {
        @Index(name = "idx_files_user_id_timestamp", columnList = "user_id, timestamp"),
        @Index(name = "idx_files_user_id_originalName", columnList = "user_id, originalName"),
        @Index(name = "idx_files_user_id_size", columnList = "user_id, size")
})
@Getter
@Setter
@NoArgsConstructor
public class File {
    @Id
    private UUID id;

    @Column(nullable = false)
    private Long timestamp;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, length = FileConstants.FILENAME_MAX_LENGTH)
    private String originalName;

    @Column(nullable = false)
    private Long size;
}
