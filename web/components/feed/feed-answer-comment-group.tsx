import { Answer } from 'common/answer'
import { Bet } from 'common/bet'
import { Comment } from 'common/comment'
import { formatPercent } from 'common/util/format'
import React, { useEffect, useState } from 'react'
import { Col } from 'web/components/layout/col'
import { Modal } from 'web/components/layout/modal'
import { AnswerBetPanel } from 'web/components/answers/answer-bet-panel'
import { Row } from 'web/components/layout/row'
import { Avatar } from 'web/components/avatar'
import { UserLink } from 'web/components/user-page'
import { Linkify } from 'web/components/linkify'
import clsx from 'clsx'
import { tradingAllowed } from 'web/lib/firebase/contracts'
import { BuyButton } from 'web/components/yes-no-selector'
import {
  CommentInput,
  CommentRepliesList,
  getMostRecentCommentableBet,
} from 'web/components/feed/feed-comments'
import { CopyLinkDateTimeComponent } from 'web/components/feed/copy-link-date-time'
import { useRouter } from 'next/router'
import { groupBy } from 'lodash'
import { User } from 'common/user'
import { useEvent } from 'web/hooks/use-event'
import { getDpmOutcomeProbability } from 'common/calculate-dpm'

export function FeedAnswerCommentGroup(props: {
  contract: any
  user: User | undefined | null
  answer: Answer
  comments: Comment[]
  bets: Bet[]
}) {
  const { answer, contract, comments, bets, user } = props
  const { username, avatarUrl, name, text } = answer

  const [replyToUsername, setReplyToUsername] = useState('')
  const [open, setOpen] = useState(false)
  const [showReply, setShowReply] = useState(false)
  const [inputRef, setInputRef] = useState<HTMLTextAreaElement | null>(null)
  const [highlighted, setHighlighted] = useState(false)
  const router = useRouter()

  const answerElementId = `answer-${answer.id}`
  const betsByUserId = groupBy(bets, (bet) => bet.userId)
  const commentsByUserId = groupBy(comments, (comment) => comment.userId)
  const commentsList = comments.filter(
    (comment) => comment.answerOutcome === answer.number.toString()
  )
  const thisAnswerProb = getDpmOutcomeProbability(
    contract.totalShares,
    answer.id
  )
  const probPercent = formatPercent(thisAnswerProb)
  const betsByCurrentUser = (user && betsByUserId[user.id]) ?? []
  const commentsByCurrentUser = (user && commentsByUserId[user.id]) ?? []
  const isFreeResponseContractPage = !!commentsByCurrentUser
  const mostRecentCommentableBet = getMostRecentCommentableBet(
    betsByCurrentUser,
    commentsByCurrentUser,
    user,
    answer.number.toString()
  )
  const [usersMostRecentBetTimeAtLoad, setUsersMostRecentBetTimeAtLoad] =
    useState<number | undefined>(
      !user ? undefined : mostRecentCommentableBet?.createdTime ?? 0
    )

  useEffect(() => {
    if (user && usersMostRecentBetTimeAtLoad === undefined)
      setUsersMostRecentBetTimeAtLoad(
        mostRecentCommentableBet?.createdTime ?? 0
      )
  }, [
    mostRecentCommentableBet?.createdTime,
    user,
    usersMostRecentBetTimeAtLoad,
  ])

  const scrollAndOpenReplyInput = useEvent(
    (comment?: Comment, answer?: Answer) => {
      setReplyToUsername(comment?.userUsername ?? answer?.username ?? '')
      setShowReply(true)
      inputRef?.focus()
    }
  )

  useEffect(() => {
    if (
      mostRecentCommentableBet &&
      usersMostRecentBetTimeAtLoad !== undefined &&
      mostRecentCommentableBet.createdTime > usersMostRecentBetTimeAtLoad &&
      !showReply
    )
      scrollAndOpenReplyInput(undefined, answer)
  }, [
    answer,
    usersMostRecentBetTimeAtLoad,
    mostRecentCommentableBet,
    scrollAndOpenReplyInput,
    showReply,
  ])

  useEffect(() => {
    // Only show one comment input for a bet at a time
    if (
      betsByCurrentUser.length > 1 &&
      betsByCurrentUser.sort((a, b) => b.createdTime - a.createdTime)[0]
        ?.outcome !== answer.number.toString()
    )
      setShowReply(false)
    // Even if we pass memoized bets this still runs on every render, which we don't want
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betsByCurrentUser.length, user, answer.number])

  useEffect(() => {
    if (showReply && inputRef) inputRef.focus()
  }, [inputRef, showReply])

  useEffect(() => {
    if (router.asPath.endsWith(`#${answerElementId}`)) {
      setHighlighted(true)
    }
  }, [answerElementId, router.asPath])

  return (
    <Col className={'relative flex-1 gap-2'} key={answer.id + 'comment'}>
      <Modal open={open} setOpen={setOpen}>
        <AnswerBetPanel
          answer={answer}
          contract={contract}
          closePanel={() => setOpen(false)}
          className="sm:max-w-84 !rounded-md bg-white !px-8 !py-6"
          isModal={true}
        />
      </Modal>

      <Row
        className={clsx(
          'my-4 flex gap-3 space-x-3 transition-all duration-1000',
          highlighted ? `-m-2 my-3 rounded bg-indigo-500/[0.2] p-2` : ''
        )}
        id={answerElementId}
      >
        <div className="px-1">
          <Avatar username={username} avatarUrl={avatarUrl} />
        </div>
        <Col className="min-w-0 flex-1 lg:gap-1">
          <div className="text-sm text-gray-500">
            <UserLink username={username} name={name} /> answered
            <CopyLinkDateTimeComponent
              contractCreatorUsername={contract.creatorUsername}
              contractSlug={contract.slug}
              createdTime={answer.createdTime}
              elementId={answerElementId}
            />
          </div>

          <Col className="align-items justify-between gap-4 sm:flex-row">
            <span className="whitespace-pre-line text-lg">
              <Linkify text={text} />
            </span>

            <Row className="items-center justify-center gap-4">
              {isFreeResponseContractPage && (
                <div className={'sm:hidden'}>
                  <button
                    className={
                      'text-xs font-bold text-gray-500 hover:underline'
                    }
                    onClick={() => scrollAndOpenReplyInput(undefined, answer)}
                  >
                    Reply
                  </button>
                </div>
              )}

              <div className={'align-items flex w-full justify-end gap-4 '}>
                <span
                  className={clsx(
                    'text-2xl',
                    tradingAllowed(contract) ? 'text-primary' : 'text-gray-500'
                  )}
                >
                  {probPercent}
                </span>
                <BuyButton
                  className={clsx(
                    'btn-sm flex-initial !px-6 sm:flex',
                    tradingAllowed(contract) ? '' : '!hidden'
                  )}
                  onClick={() => setOpen(true)}
                />
              </div>
            </Row>
          </Col>
          {isFreeResponseContractPage && (
            <div className={'justify-initial hidden sm:block'}>
              <button
                className={'text-xs font-bold text-gray-500 hover:underline'}
                onClick={() => scrollAndOpenReplyInput(undefined, answer)}
              >
                Reply
              </button>
            </div>
          )}
        </Col>
      </Row>
      <CommentRepliesList
        contract={contract}
        commentsList={commentsList}
        betsByUserId={betsByUserId}
        smallAvatar={true}
        truncate={false}
        bets={bets}
        scrollAndOpenReplyInput={scrollAndOpenReplyInput}
        treatFirstIndexEqually={true}
      />

      {showReply && (
        <div className={'ml-6 pt-4'}>
          <span
            className="absolute -ml-[1px] mt-[0.8rem] h-2 w-0.5 rotate-90 bg-gray-200"
            aria-hidden="true"
          />
          <CommentInput
            contract={contract}
            betsByCurrentUser={betsByCurrentUser}
            commentsByCurrentUser={commentsByCurrentUser}
            parentAnswerOutcome={answer.number.toString()}
            replyToUsername={replyToUsername}
            setRef={setInputRef}
            onSubmitComment={() => setShowReply(false)}
          />
        </div>
      )}
    </Col>
  )
}
