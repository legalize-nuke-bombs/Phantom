package com.example.phantom.owner.masterwallet;

import com.example.phantom.crypto.CryptoException;
import com.example.phantom.crypto.CryptoExchangeService;
import com.example.phantom.crypto.ton.TonApiException;
import com.example.phantom.crypto.ton.TonApiService;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Service
public class MasterWalletService {

    private final UserRepository userRepository;
    private final VariableRepository variableRepository;

    private final TonApiService tonApiService;
    private final CryptoExchangeService cryptoExchangeService;

    public MasterWalletService(UserRepository userRepository, VariableRepository variableRepository, TonApiService tonApiService, CryptoExchangeService cryptoExchangeService) {
        this.userRepository = userRepository;
        this.variableRepository = variableRepository;

        this.tonApiService = tonApiService;
        this.cryptoExchangeService = cryptoExchangeService;
    }

    public MasterWalletRepresentation getTon(Long userId) {
        getOwner(userId);

        Variable address = variableRepository.findById("TON_MASTER_WALLET_ADDRESS").orElseThrow(() -> new BadRequestException("ton master wallet has not been set"));
        String addressValue = address.getValue();

        BigDecimal balance;
        try { balance = tonApiService.getBalance(addressValue); }
        catch (TonApiException e) { throw new BadGatewayException("failed to check balance"); }

        try { balance = balance.multiply(cryptoExchangeService.getTonUsdt()).setScale(FinanceConstants.SCALE, RoundingMode.DOWN); }
        catch (CryptoException e) { throw new BadGatewayException("failed to exchange"); }

        MasterWalletRepresentation representation = new MasterWalletRepresentation();
        representation.setAddress(address.getValue());
        representation.setBalance(balance);
        return representation;
    }

    @Transactional
    public Map<String, String> setTon(Long userId, SetTonMasterWalletRequest request) {
        getOwner(userId);

        String mnemonic = request.getMnemonic();
        TonApiService.WalletVersion walletVersion = request.getWalletVersion();

        TonApiService.KeyPair keyPair;
        try { keyPair = tonApiService.deriveKeyPair(mnemonic, walletVersion); }
        catch (TonApiException e) { throw new BadRequestException("bad mnemonic"); }

        Variable address = new Variable();
        address.setId("TON_MASTER_WALLET_ADDRESS");
        address.setValue(keyPair.address());
        variableRepository.save(address);

        Variable privateKey = new Variable();
        privateKey.setId("TON_MASTER_WALLET_PRIVATE_KEY");
        privateKey.setValue(keyPair.privateKey());
        variableRepository.save(privateKey);

        return Map.of("message", "set");
    }

    public User getOwner(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("user not found"));
        if (user.getRole() != Role.OWNER)  {
            throw new ForbiddenException("you don't have permission to access master wallets");
        }
        return user;
    }
}
