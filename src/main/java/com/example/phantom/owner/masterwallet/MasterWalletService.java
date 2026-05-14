package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CoinProvider;
import com.example.phantom.crypto.CoinProviderRegistry;
import com.example.phantom.crypto.CryptoException;
import com.example.phantom.exception.BadGatewayException;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

@Service
public class MasterWalletService {

    private final UserRepository userRepository;
    private final VariableRepository variableRepository;
    private final CoinProviderRegistry coinProviderRegistry;

    public MasterWalletService(
            UserRepository userRepository,
            VariableRepository variableRepository,
            CoinProviderRegistry coinProviderRegistry
    ) {
        this.userRepository = userRepository;
        this.variableRepository = variableRepository;
        this.coinProviderRegistry = coinProviderRegistry;
    }

    public MasterWalletRepresentation get(Long userId, String coin) {
        getOwner(userId);

        CoinProvider provider = coinProviderRegistry.get(coin);

        Variable address = variableRepository.findById(coin + "_MASTER_WALLET_ADDRESS")
                .orElseThrow(() -> new BadRequestException(coin + " master wallet has not been set"));

        String addressValue = address.getValue();

        BigDecimal balance;
        try {
            balance = provider.getBalanceUsd(addressValue);
        }
        catch (CryptoException e) {
            throw new BadGatewayException("failed to check balance");
        }

        MasterWalletRepresentation representation = new MasterWalletRepresentation();
        representation.setAddress(addressValue);
        representation.setBalance(balance);
        return representation;
    }

    @Transactional
    public Map<String, String> set(Long userId, String coin, SetMasterWalletRequest request) {
        getOwner(userId);

        CoinProvider provider = coinProviderRegistry.get(coin);

        CoinProvider.KeyPair keyPair;
        try {
            keyPair = provider.deriveKeyPair(request.getMnemonic());
        }
        catch (CryptoException e) {
            throw new BadRequestException("bad mnemonic");
        }

        Variable addressVar = new Variable();
        addressVar.setId(coin + "_MASTER_WALLET_ADDRESS");
        addressVar.setValue(keyPair.address());
        variableRepository.save(addressVar);

        Variable privateKeyVar = new Variable();
        privateKeyVar.setId(coin + "_MASTER_WALLET_PRIVATE_KEY");
        privateKeyVar.setValue(keyPair.privateKey());
        variableRepository.save(privateKeyVar);

        return Map.of("message", "set");
    }

    private void getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));

        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("you don't have permission to access master wallets");
        }
    }
}
