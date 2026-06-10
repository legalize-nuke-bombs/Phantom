package com.example.phantom.ref;

import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.math.BigDecimal;

@Entity
@Table(name = "ref_storages")
@Getter
@Setter
@NoArgsConstructor
public class RefStorage {
    @Id
    @Column(name = "user_id")
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal amount;

    @Column(nullable = false, precision = FinanceConstants.PRECISION, scale = FinanceConstants.SCALE)
    private BigDecimal total;
}
