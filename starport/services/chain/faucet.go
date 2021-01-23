package chain

import (
	"context"
	"fmt"

	"github.com/pkg/errors"
	chaincmdrunner "github.com/tendermint/starport/starport/pkg/chaincmd/runner"
	"github.com/tendermint/starport/starport/pkg/cosmoscoin"
	"github.com/tendermint/starport/starport/pkg/cosmosfaucet"
)

var (
	// ErrFaucetIsNotEnabled is returned when faucet is not enabled in the config.yml.
	ErrFaucetIsNotEnabled = errors.New("faucet is not enabled in the config.yml")

	// ErrFaucetAccountDoesNotExist returned when specified faucet account in the config.yml does not exist.
	ErrFaucetAccountDoesNotExist = errors.New("specified account (faucet.name) does not exist")
)

// Faucet returns the faucet for the chain or an error if the faucet
// configuration is wrong or not configured (not enabled) at all.
func (c *Chain) Faucet(ctx context.Context) (cosmosfaucet.Faucet, error) {
	conf, err := c.Config()
	if err != nil {
		return cosmosfaucet.Faucet{}, err
	}

	// validate if the faucet initialization in the config.yml is correct.
	if conf.Faucet.Name == nil {
		return cosmosfaucet.Faucet{}, ErrFaucetIsNotEnabled
	}

	if _, err := c.cmd.ShowAccount(ctx, *conf.Faucet.Name); err != nil {
		if err == chaincmdrunner.ErrAccountDoesNotExist {
			return cosmosfaucet.Faucet{}, ErrFaucetAccountDoesNotExist
		}
		return cosmosfaucet.Faucet{}, err
	}

	// construct faucet options.
	faucetOptions := []cosmosfaucet.Option{
		cosmosfaucet.Account(*conf.Faucet.Name, ""),
	}

	// parse coins to pass to the faucet as coins.
	for _, coin := range conf.Faucet.Coins {
		amount, denom, err := cosmoscoin.Parse(coin)
		if err != nil {
			return cosmosfaucet.Faucet{}, fmt.Errorf("%s: %s", err, coin)
		}

		var amountMax uint64

		// find out the max amount for this coin.
		for _, coinMax := range conf.Faucet.CoinsMax {
			amount, denomMax, err := cosmoscoin.Parse(coinMax)
			if err != nil {
				return cosmosfaucet.Faucet{}, fmt.Errorf("%s: %s", err, coin)
			}
			if denomMax == denom {
				amountMax = amount
				break
			}
		}

		faucetOptions = append(faucetOptions, cosmosfaucet.Coin(amount, amountMax, denom))
	}

	// init the faucet with options and return.
	return cosmosfaucet.New(ctx, c.cmd, faucetOptions...)
}
