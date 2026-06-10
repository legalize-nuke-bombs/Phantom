package com.example.phantom.present;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "presents", indexes = {
        @Index(name = "idx_presents_claimed", columnList = "claimed"),
        @Index(name = "idx_presents_receiver_id", columnList = "receiver_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Present {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Boolean claimed;

    @Column(nullable = false)
    private Long timestamp;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Column(nullable = false, length = PresentConstants.MAX_DESCRIPTION_LENGTH)
    private String description;

    @ManyToOne
    @JoinColumn(name = "sender_id")
    private User sender;

    @ManyToOne
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;
}
