package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeService;
import com.example.phantom.crypto.ton.TonApiException;
import com.example.phantom.crypto.ton.TonKeyService;
import com.example.phantom.crypto.ton.TonReadService;
import com.example.phantom.crypto.ton.TonWalletVersion;
import com.example.phantom.exception.BadGatewayException;
import com.example.phantom.exception.BadRequestException;
import com.example.phantom.exception.ForbiddenException;
import com.example.phantom.exception.NotFoundException;
import com.example.phantom.finance.FinanceConstants;
import com.example.phantom.user.Role;
import com.example.phantom.user.User;
import com.example.phantom.user.UserRepository;
import com.example.phantom.variable.Variable;
import com.example.phantom.variable.VariableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Service
public class MasterWalletService {

    private final UserRepository userRepository;
    private final VariableRepository variableRepository;
    private final TonReadService tonReadService;
    private final TonKeyService tonKeyService;
    private final CryptoExchangeService cryptoExchangeService;

    public MasterWalletService(UserRepository userRepository, VariableRepository variableRepository, TonReadService tonReadService, TonKeyService tonKeyService, CryptoExchangeService cryptoExchangeService) {
        this.userRepository = userRepository;
        this.variableRepository = variableRepository;
        this.tonReadService = tonReadService;
        this.tonKeyService = tonKeyService;
        this.cryptoExchangeService = cryptoExchangeService;
    }

    public MasterWalletRepresentation getTon(Long userId) {
        getOwner(userId);

        Variable address = variableRepository.findById("TON_MASTER_WALLET_ADDRESS").orElseThrow(() -> new BadRequestException("ton master wallet has not been set"));
        String addressValue = address.getValue();

        BigDecimal balance;
        try { balance = tonReadService.getBalance(addressValue); }
        catch (TonApiException e) { throw new BadGatewayException("failed to check balance"); }

        try { balance = balance.multiply(cryptoExchangeService.getTonUsdt()).setScale(FinanceConstants.SCALE, RoundingMode.DOWN); }
        catch (CryptoException e) { throw new BadGatewayException("failed to exchange"); }

        MasterWalletRepresentation representation = new MasterWalletRepresentation();
        representation.setAddress(addressValue);
        representation.setBalance(balance);
        return representation;
    }

    @Transactional
    public Map<String, String> setTon(Long userId, SetTonMasterWalletRequest request) {
        getOwner(userId);

        String mnemonic = request.getMnemonic();
        TonWalletVersion walletVersion = request.getWalletVersion();

        TonKeyService.KeyPair keyPair;
        try { keyPair = tonKeyService.deriveKeyPair(mnemonic, walletVersion); }
        catch (TonApiException e) { throw new BadRequestException("bad mnemonic"); }

        Variable addressVar = new Variable();
        addressVar.setId("TON_MASTER_WALLET_ADDRESS");
        addressVar.setValue(keyPair.address());
        variableRepository.save(addressVar);

        Variable privateKeyVar = new Variable();
        privateKeyVar.setId("TON_MASTER_WALLET_PRIVATE_KEY");
        privateKeyVar.setValue(keyPair.privateKey());
        variableRepository.save(privateKeyVar);

        return Map.of("message", "set");
    }

    public User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (user.getRole() != Role.OWNER) {
            throw new ForbiddenException("you don't have permission to access master wallets");
        }
        return user;
    }
}